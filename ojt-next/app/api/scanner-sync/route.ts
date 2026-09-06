import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

// POST body: { student_id, action_type: TIME_IN|TIME_OUT, method: FACE|QR,
//              scanned_at (ISO datetime), device_id }
// Called by app/scanner/page.tsx from the browser — same contract as
// the PHP version's scanner_sync.php, called by frontend/scanner.php.

function reject(reason: string) {
  return NextResponse.json({ accepted: false, verification_status: "REJECTED", reason });
}

function inWindow(now: string, start: string, end: string): boolean {
  return now >= start && now <= end;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const studentId = String(b.student_id || "").trim();
  const actionType = b.action_type || "";
  const method = b.method || "";

  if (!studentId || !["TIME_IN", "TIME_OUT"].includes(actionType) || !["FACE", "QR"].includes(method)) {
    return reject("Malformed scan event.");
  }
  if (actionType === "TIME_IN" && method !== "FACE") {
    return reject("TIME_IN must use FACE recognition.");
  }
  if (actionType === "TIME_OUT" && method !== "QR") {
    return reject("TIME_OUT must use QR code.");
  }

  const user = await queryOne<any>(
    `SELECT id, first_name, last_name, (first_name || ' ' || last_name) AS full_name,
            section, company_advisor, is_active
     FROM users WHERE student_id = $1`,
    [studentId]
  );
  if (!user || !user.is_active) {
    return reject("Unrecognized or inactive student ID.");
  }

  const settings = await queryOne<any>("SELECT * FROM settings WHERE id = 1");
  if (!settings) {
    return NextResponse.json({ detail: "Settings not initialized." }, { status: 500 });
  }

  // Server clock, not the kiosk's — matches the PHP version exactly.
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const nowTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const nowStr = `${today} ${nowTime}`;

  let shift: "AM" | "PM" | null = null;
  if (actionType === "TIME_IN") {
    if (inWindow(nowTime, settings.am_time_in_start, settings.am_time_in_end)) shift = "AM";
    else if (inWindow(nowTime, settings.pm_time_in_start, settings.pm_time_in_end)) shift = "PM";
    else return reject("Outside the TIME-IN window for the current shift.");
  } else {
    if (inWindow(nowTime, settings.am_time_out_start, settings.am_time_out_end)) shift = "AM";
    else if (inWindow(nowTime, settings.pm_time_out_start, settings.pm_time_out_end)) shift = "PM";
    else return reject("Outside the TIME-OUT window for the current shift.");
  }

  const record = await queryOne<any>(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = $2 AND shift = $3",
    [user.id, today, shift]
  );

  if (actionType === "TIME_IN") {
    if (record && record.time_in !== null) {
      return reject("Already timed in for this shift.");
    }
    if (record) {
      await queryOne(
        "UPDATE attendance SET time_in = $1, time_in_method = 'FACE', status = 'INCOMPLETE' WHERE id = $2",
        [nowStr, record.id]
      );
    } else {
      await queryOne(
        `INSERT INTO attendance (user_id, date, shift, time_in, time_in_method, status)
         VALUES ($1,$2,$3,$4,'FACE','INCOMPLETE')`,
        [user.id, today, shift, nowStr]
      );
    }
  } else {
    if (!record || record.time_in === null) {
      return reject("Cannot time out — no matching TIME-IN found for this shift.");
    }
    if (record.time_out !== null) {
      return reject("Already timed out for this shift.");
    }
    const timeIn = new Date(record.time_in);
    const hours = Math.round(((now.getTime() - timeIn.getTime()) / 3600000) * 100) / 100;
    await queryOne(
      "UPDATE attendance SET time_out = $1, time_out_method = 'QR', total_hours_rendered = $2, status = 'PRESENT' WHERE id = $3",
      [nowStr, hours, record.id]
    );
  }

  return NextResponse.json({
    accepted: true,
    verification_status: "VERIFIED_SUCCESS",
    student_id: studentId,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: user.full_name,
    section: user.section,
    company_advisor: user.company_advisor,
    action_type: actionType,
    shift,
    server_timestamp: nowStr,
  });
}
