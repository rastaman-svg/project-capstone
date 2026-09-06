import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function GET() {
  return withErrorHandling(async () => {
    await requireAdmin();
    const rows = await query<any>(
      `SELECT id, student_id, first_name, last_name,
              (first_name || ' ' || last_name) AS full_name,
              email, program_type, year_level, course, section,
              company_advisor, ojt_start_date, total_required_hours, is_active
       FROM users ORDER BY last_name, first_name`
    );
    for (const r of rows) {
      r.total_required_hours = Number(r.total_required_hours);
    }
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const b = await req.json();

    const required = ["student_id", "first_name", "last_name", "email", "program_type", "year_level", "course", "company_advisor", "ojt_start_date"];
    for (const field of required) {
      if (!b[field]) return jsonError(`Field '${field}' is required.`, 400);
    }

    const settingsCol = b.program_type === "SHS_WORK_IMMERSION" ? "shs_default_hours" : "college_ojt_default_hours";
    const settingsRow = await queryOne<any>(`SELECT ${settingsCol} AS default_hours FROM settings WHERE id = 1`);
    const requiredHours = b.total_required_hours ?? (settingsRow ? Number(settingsRow.default_hours) : 486.0);

    await query(
      `INSERT INTO users (student_id, first_name, last_name, email, program_type, year_level, course, section,
                           company_advisor, ojt_start_date, total_required_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        b.student_id, b.first_name.trim(), b.last_name.trim(), b.email, b.program_type,
        b.year_level, b.course, b.section || null, b.company_advisor, b.ojt_start_date, requiredHours,
      ]
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
