import { NextRequest, NextResponse } from "next/server";

const COMFY_URL = "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get("filename");
    if (!filename) {
      return new NextResponse("Filename is required", { status: 400 });
    }

    const comfyRes = await fetch(
      `${COMFY_URL}/view?filename=${encodeURIComponent(filename)}&type=output`
    );

    if (!comfyRes.ok) {
      return new NextResponse(`Failed to fetch image: ${comfyRes.statusText}`, {
        status: comfyRes.status,
      });
    }

    const imageBuffer = await comfyRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Failed to proxy image", {
      status: 500,
    });
  }
}
