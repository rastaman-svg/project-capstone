import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const programType = req.nextUrl.searchParams.get("program_type");

    if (programType && !["COLLEGE_OJT", "SHS_WORK_IMMERSION"].includes(programType)) {
      return jsonError("program_type must be COLLEGE_OJT or SHS_WORK_IMMERSION.", 400);
    }

    if (programType) {
      const rows = await query<{ course: string }>(
        `SELECT DISTINCT course FROM users WHERE program_type = $1 AND course IS NOT NULL AND course != '' ORDER BY course`,
        [programType]
      );
      return NextResponse.json({ courses: rows.map((r) => r.course) });
    }

    const rows = await query<{ course: string; program_type: string }>(
      `SELECT DISTINCT course, program_type FROM users WHERE course IS NOT NULL AND course != '' ORDER BY course`
    );
    return NextResponse.json({ courses: rows });
  });
}
