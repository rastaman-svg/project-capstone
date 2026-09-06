import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-helpers";

export async function GET() {
  return withErrorHandling(async () => {
    const latest = await queryOne<any>(
      "SELECT is_power_online, created_at FROM power_events ORDER BY created_at DESC LIMIT 1"
    );
    return NextResponse.json({
      is_power_online: latest ? latest.is_power_online : true,
      power_restored_timestamp: latest?.is_power_online ? latest.created_at : null,
      power_cut_timestamp: latest && !latest.is_power_online ? latest.created_at : null,
    });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const admin = await requireAdmin();
    const b = await req.json();
    await query(
      "INSERT INTO power_events (is_power_online, note, changed_by_admin_id) VALUES ($1,$2,$3)",
      [!!b.is_power_online, b.note || null, admin.adminId]
    );
    return NextResponse.json({ ok: true });
  });
}
