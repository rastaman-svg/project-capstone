import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getAdminSession, getStudentSession } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

// GET /api/attendance?student_id=X            -> that student's log
// GET /api/attendance?student_id=X&summary=1  -> hours summary
// GET /api/attendance                         -> full ledger, admin-only
//
// Unlike the PHP version's attendance.php, student_id lookups are NOT
// public here — the caller must be an admin, or a student session
// matching that exact student_id. This closes the gap the PHP
// README flagged (anyone who knew a student_id could view their
// hours). The Next.js pages never actually needed the public path —
// app/student/page.tsx queries the DB directly server-side using the
// student's own session, so tightening this broke nothing.

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const studentId = req.nextUrl.searchParams.get("student_id")?.trim();
    const admin = await getAdminSession();

    if (!studentId) {
      if (!admin) return jsonError("Admin login required.", 401);

      const rows = await query<any>(
        `SELECT a.id, u.student_id, (u.first_name || ' ' || u.last_name) AS full_name,
                u.program_type, u.year_level, u.course, u.section,
                a.date, a.shift, a.time_in, a.time_out, a.total_hours_rendered, a.status
         FROM attendance a JOIN users u ON u.id = a.user_id
         ORDER BY a.date DESC, a.time_in DESC`
      );
      for (const r of rows) {
        if (r.total_hours_rendered !== null) r.total_hours_rendered = Number(r.total_hours_rendered);
      }
      return NextResponse.json(rows);
    }

    if (!admin) {
      const student = await getStudentSession();
      if (!student || student.studentId !== studentId) {
        return jsonError("Not authorized to view this student's attendance.", 403);
      }
    }

    const user = await queryOne<any>(
      `SELECT id, (first_name || ' ' || last_name) AS full_name, program_type, year_level, course, section, total_required_hours
       FROM users WHERE student_id = $1`,
      [studentId]
    );
    if (!user) return jsonError("Student not found.", 404);

    if (req.nextUrl.searchParams.has("summary")) {
      const totalRow = await queryOne<any>(
        "SELECT COALESCE(SUM(total_hours_rendered), 0) AS total FROM attendance WHERE user_id = $1",
        [user.id]
      );
      const rendered = Number(totalRow.total);
      const required = Number(user.total_required_hours);

      return NextResponse.json({
        student_id: studentId,
        full_name: user.full_name,
        program_type: user.program_type,
        year_level: user.year_level,
        course: user.course,
        section: user.section,
        rendered_hours: rendered,
        required_hours: required,
        remaining_hours: Math.max(required - rendered, 0),
      });
    }

    const rows = await query<any>(
      "SELECT id, date, shift, time_in, time_out, total_hours_rendered, status FROM attendance WHERE user_id = $1 ORDER BY date DESC",
      [user.id]
    );
    for (const r of rows) {
      if (r.total_hours_rendered !== null) r.total_hours_rendered = Number(r.total_hours_rendered);
    }
    return NextResponse.json(rows);
  });
}
