import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { createStudentSession } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = await req.json();
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return jsonError("Email and password are required.", 400);
    }

    const student = await queryOne<any>(
      `SELECT id, student_id, first_name, last_name, email, password_hash, program_type,
              year_level, course, section, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (!student || !student.password_hash || !(await bcrypt.compare(password, student.password_hash))) {
      return jsonError("Incorrect email or password.", 401);
    }
    if (!student.is_active) {
      return jsonError("This account has been deactivated. Contact your OJT adviser.", 403);
    }

    await createStudentSession(student.id, student.student_id);

    delete student.password_hash;
    delete student.is_active;
    return NextResponse.json({ student });
  });
}
