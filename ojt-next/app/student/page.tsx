import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import StudentDashboardClient from "./dashboard-client";

export default async function StudentPage() {
  const session = await getStudentSession();
  if (!session) redirect("/student-login");

  const profile = await queryOne<any>(
    `SELECT id, student_id, first_name, last_name, program_type, year_level, course, section,
            company_advisor, ojt_start_date, total_required_hours
     FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!profile) redirect("/student-login");
  profile.total_required_hours = Number(profile.total_required_hours);
  // profile.ojt_start_date is already "YYYY-MM-DD" — see lib/db.ts's DATE type parser override

  const totalRow = await queryOne<any>(
    "SELECT COALESCE(SUM(total_hours_rendered), 0) AS total FROM attendance WHERE user_id = $1",
    [session.userId]
  );
  const rendered = Number(totalRow.total);
  const required = profile.total_required_hours;

  const records = await query<any>(
    "SELECT id, date, shift, time_in, time_out, total_hours_rendered, status FROM attendance WHERE user_id = $1 ORDER BY date DESC",
    [session.userId]
  );
  for (const r of records) {
    if (r.total_hours_rendered !== null) r.total_hours_rendered = Number(r.total_hours_rendered);
    // r.date is already "YYYY-MM-DD" — see lib/db.ts's DATE type parser override
    r.time_in = r.time_in ? r.time_in.toISOString() : null;
    r.time_out = r.time_out ? r.time_out.toISOString() : null;
  }

  return (
    <StudentDashboardClient
      profile={profile}
      summary={{ rendered_hours: rendered, required_hours: required, remaining_hours: Math.max(required - rendered, 0) }}
      records={records}
    />
  );
}
