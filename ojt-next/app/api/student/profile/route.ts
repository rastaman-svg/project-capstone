import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function GET() {
  return withErrorHandling(async () => {
    const session = await requireStudent();

    const student = await queryOne<any>(
      `SELECT id, student_id, first_name, last_name, email, program_type, year_level, course,
              section, company_advisor, ojt_start_date, total_required_hours
       FROM users WHERE id = $1`,
      [session.userId]
    );

    if (!student) return jsonError("Student not found.", 404);

    student.total_required_hours = Number(student.total_required_hours);
    return NextResponse.json(student);
  });
}
