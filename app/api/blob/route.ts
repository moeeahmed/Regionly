import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCtx } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const ctx = await getCtx();
        if (!ctx) throw new Error("Sign in to upload.");
        return {
          allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ workspaceId: ctx.workspace.id }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
