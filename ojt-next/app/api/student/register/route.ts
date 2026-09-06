import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool, queryOne } from "@/lib/db";
import { createStudentSession } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { courseInitials } from "@/lib/student-id";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const b = await req.json();

    const required = ["first_name", "last_name", "email", "password", "program_type", "year_level", "course", "company_advisor", "ojt_start_date"];
    for (const field of required) {
      if (!b[field]) return jsonError(`Field '${field}' is required.`, 400);
    }

    if (!["COLLEGE_OJT", "SHS_WORK_IMMERSION"].includes(b.program_type)) {
      return jsonError("program_type must be COLLEGE_OJT or SHS_WORK_IMMERSION.", 400);
    }

    const email = String(b.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Please enter a valid email address.", 400);
    }

    if (String(b.password).length < 8) {
      return jsonError("Password must be at least 8 characters.", 400);
    }

    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
    if (existing) {
      return jsonError("An account with this email already exists. Try logging in instead.", 409);
    }

    const code = courseInitials(String(b.course));

    // Same race-safe approach as the PHP version: lock matching rows
    // inside a transaction so two students registering at the same
    // instant with the same course can't collide on one student_id.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const lastRow = await client.query(
        "SELECT student_id FROM users WHERE student_id LIKE $1 ORDER BY student_id DESC LIMIT 1 FOR UPDATE",
        [`${code}-%`]
      );
      let nextSeq = 1;
      if (lastRow.rows[0]) {
        const parts = lastRow.rows[0].student_id.split("-");
        nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
      }
      const studentId = `${code}-${String(nextSeq).padStart(4, "0")}`;

      const settingsCol = b.program_type === "SHS_WORK_IMMERSION" ? "shs_default_hours" : "college_ojt_default_hours";
      const settingsRow = await client.query(`SELECT ${settingsCol} AS default_hours FROM settings WHERE id = 1`);
      const requiredHours = settingsRow.rows[0] ? Number(settingsRow.rows[0].default_hours) : 486.0;

      const passwordHash = await bcrypt.hash(String(b.password), 10);
      const section = b.section || null;

      const inserted = await client.query(
        `INSERT INTO users (student_id, first_name, last_name, email, password_hash, program_type,
                             year_level, course, section, company_advisor, ojt_start_date, total_required_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          studentId, String(b.first_name).trim(), String(b.last_name).trim(), email, passwordHash,
          b.program_type, b.year_level, b.course, section, b.company_advisor, b.ojt_start_date, requiredHours,
        ]
      );
      const userId = inserted.rows[0].id;

      await client.query("COMMIT");

      await createStudentSession(userId, studentId);

      return NextResponse.json(
        {
          student: {
            id: userId,
            student_id: studentId,
            first_name: String(b.first_name).trim(),
            last_name: String(b.last_name).trim(),
            email,
            program_type: b.program_type,
            year_level: b.year_level,
            course: b.course,
            section,
          },
        },
        { status: 201 }
      );
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
}
