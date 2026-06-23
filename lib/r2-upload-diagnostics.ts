import { createProjectFileUploadUrl } from "@/lib/project-storage";

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

function uploadPathPrefix(uploadUrl: URL) {
  return uploadUrl.pathname.split("/").slice(0, 3).join("/");
}

export async function runR2CorsDiagnostic(origin: string) {
  const uploadUrl = await createProjectFileUploadUrl({
    projectId: "r2-diagnostics",
    relativePath: `cors-${Date.now()}.txt`,
    contentType: "text/plain",
  });
  const parsedUploadUrl = new URL(uploadUrl);

  try {
    const preflightResponse = await fetch(uploadUrl, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
      },
    });

    return {
      ok: preflightResponse.ok,
      origin,
      status: preflightResponse.status,
      statusText: preflightResponse.statusText,
      uploadHost: parsedUploadUrl.host,
      uploadPathPrefix: uploadPathPrefix(parsedUploadUrl),
      cors: {
        allowOrigin: preflightResponse.headers.get("access-control-allow-origin"),
        allowMethods: preflightResponse.headers.get("access-control-allow-methods"),
        allowHeaders: preflightResponse.headers.get("access-control-allow-headers"),
        exposeHeaders: preflightResponse.headers.get("access-control-expose-headers"),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: "R2 preflight request failed before receiving a response.",
      origin,
      uploadHost: parsedUploadUrl.host,
      uploadPathPrefix: uploadPathPrefix(parsedUploadUrl),
      error: errorDetails(error),
    };
  }
}
