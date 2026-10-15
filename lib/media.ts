import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { put } from "@vercel/blob";
// @ts-ignore -- types ship with some versions of ffmpeg-static only
import ffmpegStatic from "ffmpeg-static";

function ffmpegBin(): string {
  const p = (process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string | null)) ?? null;
  if (!p) throw new Error("ffmpeg binary not available on this platform");
  return p;
}

export function runFfmpeg(args: string[], timeoutMs = 240_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegBin(), ["-hide_banner", ...args], { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`ffmpeg failed: ${String(stderr).split("\n").slice(-6).join(" ").slice(0, 600)}`);
        (e as Error & { stderr?: string }).stderr = String(stderr);
        reject(e);
      } else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

export async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "rg-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${url.slice(0, 120)}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  return dest;
}

export type Probe = { duration: number; width: number | null; height: number | null; hasAudio: boolean };

export async function probe(file: string): Promise<Probe> {
  let stderr = "";
  try {
    // `-f null -` with -t 0 keeps it fast but still prints stream info
    ({ stderr } = await runFfmpeg(["-i", file, "-t", "0", "-f", "null", "-"]));
  } catch (e) {
    stderr = (e as { stderr?: string }).stderr ?? "";
  }
  const d = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
  const v = stderr.match(/Stream #.*Video:.*?(\d{2,5})x(\d{2,5})/);
  let width = v ? Number(v[1]) : null;
  let height = v ? Number(v[2]) : null;
  const rot = stderr.match(/rotation of (-?\d+(?:\.\d+)?) degrees|displaymatrix: rotation of (-?\d+)/);
  const angle = rot ? Math.abs(Number(rot[1] ?? rot[2])) : 0;
  if (width && height && (angle === 90 || angle === 270)) [width, height] = [height, width];
  return { duration, width, height, hasAudio: /Stream #.*Audio:/.test(stderr) };
}

export async function extractFrame(input: string, atSec: number, out: string) {
  await runFfmpeg(["-y", "-ss", String(Math.max(0, atSec)), "-i", input, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", out]);
  return out;
}

export async function extractAudio(input: string, out: string) {
  await runFfmpeg(["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "64k", out]);
  return out;
}

/** Wrap raw 16-bit little-endian PCM in a WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate = 44100, channels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function pcmSeconds(pcm: Buffer, sampleRate = 44100) {
  return pcm.length / (sampleRate * 2);
}

/** Replace a video's audio track; output is trimmed to the video length. */
export async function muxAudio(video: string, audio: string, out: string, durationSec: number) {
  await runFfmpeg([
    "-y", "-i", video, "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    ...(durationSec > 0 ? ["-t", durationSec.toFixed(2)] : []),
    "-movflags", "+faststart", out,
  ]);
  return out;
}

/** Normalise each clip to the same size/fps, lay its voiceover on top, then concatenate. */
export async function stitch(dir: string, clips: { video: string; audio: string }[], w: number, h: number, out: string) {
  const parts: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const p = await probe(clips[i].video);
    const seg = join(dir, `seg_${i}.mp4`);
    await runFfmpeg([
      "-y", "-i", clips[i].video, "-i", clips[i].audio,
      "-filter_complex",
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[v];[1:a]aresample=44100,aformat=channel_layouts=stereo,apad[a]`,
      "-map", "[v]", "-map", "[a]",
      ...(p.duration > 0 ? ["-t", p.duration.toFixed(2)] : ["-shortest"]),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
      seg,
    ]);
    parts.push(seg);
  }
  const list = join(dir, "concat.txt");
  await writeFile(list, parts.map((p) => `file '${p}'`).join("\n"));
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  return out;
}

export async function uploadFile(path: string, pathname: string, contentType: string) {
  const body = await readFile(path);
  return uploadBuffer(body, pathname, contentType);
}

export async function uploadBuffer(body: Buffer, pathname: string, contentType: string) {
  const blob = await put(pathname, body, { access: "public", contentType, addRandomSuffix: true });
  return blob.url;
}
