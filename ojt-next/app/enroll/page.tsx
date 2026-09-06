import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { query } from "@/lib/db";
import EnrollClient from "./enroll-client";

export default async function EnrollPage() {
  const session = await getAdminSession();
  if (!session) redirect("/aclc-staff-9f2k7q");

  const users = await query<any>(
    `SELECT student_id, (first_name || ' ' || last_name) AS full_name, course, section FROM users ORDER BY last_name, first_name`
  );

  return <EnrollClient initialUsers={users} />;
}
