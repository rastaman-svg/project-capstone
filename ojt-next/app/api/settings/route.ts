import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-helpers";

export async function GET() {
  return withErrorHandling(async () => {
    await requireAdmin();
    const s = await queryOne<any>("SELECT * FROM settings WHERE id = 1");
    return NextResponse.json(s);
  });
}

export async function PUT(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const b = await req.json();
    const fields = [
      "college_ojt_default_hours", "shs_default_hours",
      "am_time_in_start", "am_time_in_end", "pm_time_in_start", "pm_time_in_end",
      "am_time_out_start", "am_time_out_end", "pm_time_out_start", "pm_time_out_end",
    ];
    const sets = fields.filter((f) => f in b).map((f, i) => `${f} = $${i + 1}`);
    const values = fields.filter((f) => f in b).map((f) => b[f]);
    if (sets.length) {
      await queryOne(`UPDATE settings SET ${sets.join(", ")} WHERE id = 1`, values);
    }
    const s = await queryOne<any>("SELECT * FROM settings WHERE id = 1");
    return NextResponse.json(s);
  });
}
