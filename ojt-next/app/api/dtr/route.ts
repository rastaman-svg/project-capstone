import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const session = await requireStudent();

    const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return new NextResponse("Invalid month. Use YYYY-MM.", { status: 400 });
    }

    const user = await queryOne<any>(
      `SELECT student_id, first_name, last_name, program_type, year_level, course, section, company_advisor
       FROM users WHERE id = $1`,
      [session.userId]
    );
    if (!user) return new NextResponse("Student not found.", { status: 404 });

    const rows = await query<any>(
      `SELECT date, shift, time_in, time_out
       FROM attendance
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
       ORDER BY date ASC, shift ASC`,
      [session.userId, month]
    );

    const byDate: Record<string, any> = {};
    const timeOnly = (dt: string | null) =>
      dt ? new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

    for (const r of rows) {
      const d = r.date; // already "YYYY-MM-DD" — see lib/db.ts's DATE type parser override
      if (!byDate[d]) byDate[d] = { am_in: "", am_out: "", pm_in: "", pm_out: "" };
      if (r.shift === "AM") {
        byDate[d].am_in = timeOnly(r.time_in);
        byDate[d].am_out = timeOnly(r.time_out);
      } else {
        byDate[d].pm_in = timeOnly(r.time_in);
        byDate[d].pm_out = timeOnly(r.time_out);
      }
    }

    const totalRow = await queryOne<any>(
      `SELECT COALESCE(SUM(total_hours_rendered), 0) AS total FROM attendance
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2`,
      [session.userId, month]
    );
    const monthTotal = Number(totalRow.total);

    const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const studentName = `${user.last_name}, ${user.first_name}`;
    const course = `${user.course}${user.section ? " — " + user.section : ""}`;
    const programLabel = user.program_type === "SHS_WORK_IMMERSION" ? "SHS Work Immersion" : "College OJT";
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

    const sortedDates = Object.keys(byDate).sort();
    const rowsHtml = sortedDates.length
      ? sortedDates
          .map((d) => {
            const day = byDate[d];
            const label = new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", weekday: "short" });
            return `<tr>
              <td class="date-cell">${label}</td>
              <td>${day.am_in || "—"}</td><td>${day.am_out || "—"}</td>
              <td>${day.pm_in || "—"}</td><td>${day.pm_out || "—"}</td>
              <td></td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6">No attendance records for this month.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>DTR — ${esc(studentName)} — ${esc(monthLabel)}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; margin: 0; }
  .header { text-align: center; margin-bottom: 18px; }
  .header h1 { font-size: 15px; margin: 0 0 4px; letter-spacing: 1px; }
  .header .sub { font-size: 11px; color: #444; }
  .meta { margin: 16px 0; font-size: 12px; }
  .meta div { margin-bottom: 4px; }
  .meta b { display: inline-block; width: 130px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
  th { background: #f0f0f0; font-size: 10.5px; }
  td.date-cell { text-align: left; font-weight: bold; }
  tfoot td { font-weight: bold; background: #f7f7f7; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 50px; }
  .sign-box { text-align: center; width: 45%; }
  .sign-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 11px; }
  .print-btn { margin: 16px 0; }
  @media print { .print-btn { display: none; } }
</style></head>
<body>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
<div class="header">
  <h1>DAILY TIME RECORD</h1>
  <div class="sub">ACLC College Daet Campus — OJT &amp; Work Immersion Attendance System</div>
</div>
<div class="meta">
  <div><b>Name:</b> ${esc(studentName)}</div>
  <div><b>Student ID:</b> ${esc(user.student_id)}</div>
  <div><b>Program:</b> ${programLabel} — ${esc(user.year_level)}</div>
  <div><b>Course/Strand:</b> ${esc(course)}</div>
  <div><b>Company Adviser:</b> ${esc(user.company_advisor)}</div>
  <div><b>Month:</b> ${esc(monthLabel)}</div>
</div>
<table>
  <thead>
    <tr><th rowspan="2">Date</th><th colspan="2">Morning (AM)</th><th colspan="2">Afternoon (PM)</th><th rowspan="2">Hours</th></tr>
    <tr><th>Time In</th><th>Time Out</th><th>Time In</th><th>Time Out</th></tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr><td colspan="5">TOTAL HOURS RENDERED</td><td>${monthTotal.toFixed(1)}</td></tr></tfoot>
</table>
<div class="sign-row">
  <div class="sign-box"><div class="sign-line">Student Signature</div></div>
  <div class="sign-box"><div class="sign-line">Company Adviser / OJT Coordinator</div></div>
</div>
</body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}
