"use client";

import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Decodes `to` letter by letter out of random characters, then calls `done`. Returns a cancel function. */
function decode(to: string, set: (s: string) => void, done?: () => void) {
  let frame = 0;
  let raf = 0;
  let last = 0;
  const total = to.length * 2 + 6;
  const tick = (t: number) => {
    if (t - last > 38) {
      last = t;
      frame++;
      set(
        to
          .split("")
          .map((ch, i) => (ch === " " || frame > i * 2 + 4 ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]))
          .join(""),
      );
      if (frame >= total) {
        set(to);
        done?.();
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Cycles through `words`, decoding each one in. Screen readers get `label` instead. */
export function ScrambleCycle({ words, label, className, every = 2600 }: { words: string[]; label: string; className?: string; every?: number }) {
  const [text, setText] = useState(words[0]);
  const width = Math.max(...words.map((w) => w.length));
  useEffect(() => {
    if (reducedMotion()) return;
    let i = 0;
    let cancel: (() => void) | undefined;
    const id = window.setInterval(() => {
      i = (i + 1) % words.length;
      cancel?.();
      cancel = decode(words[i], setText);
    }, every);
    return () => {
      window.clearInterval(id);
      cancel?.();
    };
  }, [words, every]);
  return (
    <span className={className}>
      <span className="sr">{label}</span>
      <span aria-hidden style={{ display: "inline-block", minWidth: `${width}ch` }}>{text}</span>
    </span>
  );
}

/** Decodes `text` in once, when it scrolls into view. */
export function ScrambleIn({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return;
    let cancel: (() => void) | undefined;
    setShown(text.replace(/[^ ]/g, "·"));
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        window.setTimeout(() => (cancel = decode(text, setShown)), 450);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancel?.();
    };
  }, [text]);
  return (
    <span ref={ref} className={className}>
      <span className="sr">{text}</span>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
