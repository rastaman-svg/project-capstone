import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { queryOne, query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withErrorHandling(async () => {
    await requireAdmin();

    const id = parseInt(params.id, 10);
    if (Number.isNaN(id)) return jsonError("Invalid resource id.", 400);

    const row = await queryOne<any>("SELECT stored_path FROM resources WHERE id = $1", [id]);
    if (!row) return jsonError("Resource not found.", 404);

    try {
      await del(row.stored_path);
    } catch (e) {
      // Blob may already be gone — don't block removing the DB row over it.
      console.error("Blob delete failed (continuing):", e);
    }

    await query("DELETE FROM resources WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  });
}
