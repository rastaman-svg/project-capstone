import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { query } from "@/lib/db";
import AdminDashboardClient from "./dashboard-client";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/aclc-staff-9f2k7q");

  const users = await query<any>(
    `SELECT student_id, first_name, last_name, (first_name || ' ' || last_name) AS full_name,
            email, program_type, year_level, course, section, company_advisor,
            ojt_start_date, total_required_hours, is_active
     FROM users ORDER BY last_name, first_name`
  );
  for (const u of users) {
    u.total_required_hours = Number(u.total_required_hours);
    // u.ojt_start_date is already "YYYY-MM-DD" — see lib/db.ts's DATE type parser override
  }

  return <AdminDashboardClient initialUsers={users} />;
}
