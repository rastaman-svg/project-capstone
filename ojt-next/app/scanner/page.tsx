import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import ScannerClient from "./scanner-client";

export default async function ScannerPage() {
  const session = await getAdminSession();
  if (!session) redirect("/aclc-staff-9f2k7q");
  return <ScannerClient />;
}
