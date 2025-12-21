import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);

    return NextResponse.json({
      ok: true,
      user: ctx,
    });
  } catch (err: any) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
