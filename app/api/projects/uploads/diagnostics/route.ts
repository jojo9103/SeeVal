import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import {
  assertR2StorageEnabled,
  createProjectFileUploadUrl,
} from "@/lib/project-storage";

export const runtime = "nodejs";

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  const cause = error.cause;

  return {
    name: error.name,
    message: error.message,
    cause:
      cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
          }
        : cause,
  };
}

export async function GET(request: Request) {
  try {
    assertR2StorageEnabled();
    await requireUser();

    const requestUrl = new URL(request.url);
    const origin =
      requestUrl.searchParams.get("origin") ??
      request.headers.get("origin") ??
      "https://www.seeval.kr";
    const uploadUrl = await createProjectFileUploadUrl({
      projectId: "r2-diagnostics",
      relativePath: `cors-${Date.now()}.txt`,
      contentType: "text/plain",
    });
    const parsedUploadUrl = new URL(uploadUrl);
    let preflightResponse: Response;

    try {
      preflightResponse = await fetch(uploadUrl, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PUT",
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "R2 preflight request failed before receiving a response.",
          origin,
          uploadHost: parsedUploadUrl.host,
          uploadPathPrefix: parsedUploadUrl.pathname
            .split("/")
            .slice(0, 3)
            .join("/"),
          error: errorDetails(error),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: preflightResponse.ok,
      origin,
      status: preflightResponse.status,
      statusText: preflightResponse.statusText,
      uploadHost: parsedUploadUrl.host,
      uploadPathPrefix: parsedUploadUrl.pathname.split("/").slice(0, 3).join("/"),
      cors: {
        allowOrigin: preflightResponse.headers.get("access-control-allow-origin"),
        allowMethods: preflightResponse.headers.get("access-control-allow-methods"),
        allowHeaders: preflightResponse.headers.get("access-control-allow-headers"),
        exposeHeaders: preflightResponse.headers.get("access-control-expose-headers"),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "R2 CORS 진단 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
