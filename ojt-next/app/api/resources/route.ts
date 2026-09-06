import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

// GET  /api/resources?program_type=X  -> public list (X optional; omit for both-program resources)
// POST /api/resources (multipart: title, program_type?, file)  -> admin upload
//
// Files go to Vercel Blob, not the local filesystem — the PHP version
// wrote to api/uploads/resources/, which doesn't work on Vercel's
// read-only serverless filesystem. Needs a BLOB_READ_WRITE_TOKEN env
// var; Vercel sets this automatically once Blob storage is attached
// to your project. See README for local setup.

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const programType = req.nextUrl.searchParams.get("program_type");

    const rows = programType
      ? await query<any>(
          "SELECT id, title, program_type, file_name, stored_path, uploaded_at FROM resources WHERE program_type = $1 OR program_type IS NULL ORDER BY uploaded_at DESC",
          [programType]
        )
      : await query<any>(
          "SELECT id, title, program_type, file_name, stored_path, uploaded_at FROM resources ORDER BY uploaded_at DESC"
        );

    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();

    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const programType = form.get("program_type") ? String(form.get("program_type")) : null;
    const file = form.get("file") as File | null;

    if (!title || !file) {
      return jsonError("Fields 'title' and 'file' are required.", 400);
    }
    if (programType && !["COLLEGE_OJT", "SHS_WORK_IMMERSION"].includes(programType)) {
      return jsonError("program_type must be COLLEGE_OJT or SHS_WORK_IMMERSION.", 400);
    }

    const blob = await put(`resources/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const row = await queryOne<any>(
      `INSERT INTO resources (title, program_type, file_name, stored_path)
       VALUES ($1,$2,$3,$4) RETURNING id, title, program_type, file_name, stored_path, uploaded_at`,
      [title, programType, file.name, blob.url]
    );

    return NextResponse.json(row, { status: 201 });
  });
}
