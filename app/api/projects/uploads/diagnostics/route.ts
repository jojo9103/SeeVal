import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { assertR2StorageEnabled } from "@/lib/project-storage";
import { runR2CorsDiagnostic } from "@/lib/r2-upload-diagnostics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertR2StorageEnabled();
    const user = await requireUser();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { ok: false, message: "ADMIN만 R2 진단을 확인할 수 있습니다." },
        { status: 403 }
      );
    }

    const requestUrl = new URL(request.url);
    const origin =
      requestUrl.searchParams.get("origin") ??
      request.headers.get("origin") ??
      "https://www.seeval.kr";
    const result = await runR2CorsDiagnostic(origin);

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
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
