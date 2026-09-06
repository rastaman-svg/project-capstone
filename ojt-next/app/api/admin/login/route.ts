import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { createAdminSession } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = await req.json();
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    const admin = await queryOne<{ id: number; password_hash: string }>(
      "SELECT id, password_hash FROM admin WHERE username = $1 AND is_active = TRUE",
      [username]
    );

    if (!admin || admin.password_hash === "" || !(await bcrypt.compare(password, admin.password_hash))) {
      return jsonError("Incorrect username or password.", 401);
    }

    await createAdminSession(admin.id, username);
    return NextResponse.json({ ok: true });
  });
}
