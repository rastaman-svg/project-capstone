import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function GET() {
  return withErrorHandling(async () => {
    await requireAdmin();
    const rows = await query<any>(
      `SELECT u.student_id, u.first_name, u.last_name, (u.first_name || ' ' || u.last_name) AS full_name,
              u.section, u.company_advisor, f.encoding_data
       FROM face_encodings f JOIN users u ON u.id = f.user_id
       WHERE u.is_active = TRUE`
    );
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const b = await req.json();
    const studentId = String(b.student_id || "").trim();
    const encoding = b.encoding;
    const encodingModel = typeof b.encoding_model === "string" && b.encoding_model !== "" ? b.encoding_model : "face_api_js_v1";

    if (!studentId || !Array.isArray(encoding) || encoding.length === 0) {
      return jsonError("Fields 'student_id' and 'encoding' (non-empty array) are required.", 400);
    }

    const user = await queryOne<any>("SELECT id FROM users WHERE student_id = $1", [studentId]);
    if (!user) return jsonError("Student not found.", 404);

    await query("DELETE FROM face_encodings WHERE user_id = $1", [user.id]);
    await query(
      "INSERT INTO face_encodings (user_id, encoding_data, encoding_model) VALUES ($1,$2,$3)",
      [user.id, JSON.stringify(encoding), encodingModel]
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
