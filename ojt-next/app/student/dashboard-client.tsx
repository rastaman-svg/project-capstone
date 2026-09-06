"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, fmtDate, fmtTime, stampClass } from "@/lib/client-helpers";

export default function StudentDashboardClient({ profile, summary, records }: { profile: any; summary: any; records: any[] }) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [resources, setResources] = useState<any[] | null>(null);

  useEffect(() => {
    fetch(`/api/resources?program_type=${encodeURIComponent(profile.program_type)}`)
      .then((r) => r.json())
      .then(setResources)
      .catch(() => setResources([]));
  }, [profile.program_type]);

  const pct = summary.required_hours > 0 ? Math.min(100, (summary.rendered_hours / summary.required_hours) * 100) : 0;

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    try { await apiRequest("/api/student/logout", { method: "POST" }); } catch {}
    router.push("/");
    router.refresh();
  }

  return (
    <div className="bg-photo bg-student">
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/images/logo.jpg" alt="ACLC College Daet Campus" />
          <div>
            <div className="title">ACLC College Daet Campus</div>
            <div className="subtitle">OJT &amp; Work Immersion Attendance System</div>
          </div>
        </div>
        <nav>
          <a href="#" onClick={handleLogout}>Logout</a>
          <a href="/">Home</a>
          <a href="/student" className="active">My Attendance</a>
        </nav>
      </div>

      <div className="page">
        <div className="page-head">
          <h1>Hi, {profile.first_name}</h1>
          <p>Your time-in/time-out log, rendered hours, and DTR download.</p>
        </div>

        <div className="student-grid">
          <div className="card">
            <h2>{profile.last_name}, {profile.first_name} ({profile.student_id})</h2>
            <div className="progress-ring-wrap">
              <div className="progress-ring" style={{ ["--pct" as any]: pct }}>
                <div className="ring-inner">
                  <div className="big-num">{pct.toFixed(0)}%</div>
                  <div className="big-label">Complete</div>
                </div>
              </div>
              <div className="progress-legend">
                <div className="stat"><div className="num">{summary.rendered_hours.toFixed(1)}</div><div className="label">Rendered</div></div>
                <div className="stat"><div className="num">{summary.required_hours.toFixed(1)}</div><div className="label">Required</div></div>
                <div className="stat"><div className="num">{summary.remaining_hours.toFixed(1)}</div><div className="label">Remaining</div></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Download DTR</h2>
            <p className="helper" style={{ marginTop: -6 }}>
              Generates a printable Daily Time Record with your AM/PM time-in/out already filled in for the selected month.
            </p>
            <div className="field">
              <label>Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <a className="btn" style={{ width: "100%", justifyContent: "center" }} target="_blank" href={`/api/dtr?month=${month}`}>
              Open DTR
            </a>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2>Attendance log</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Shift</th><th>Time in</th><th>Time out</th><th>Hours</th><th>Status</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.shift}</td>
                  <td>{fmtTime(r.time_in)}</td>
                  <td>{fmtTime(r.time_out)}</td>
                  <td>{r.total_hours_rendered != null ? r.total_hours_rendered.toFixed(1) : "—"}</td>
                  <td><span className={`stamp-badge ${stampClass(r.status)}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && <div className="empty-state">No attendance records yet.</div>}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2>Documents</h2>
          <p className="helper" style={{ marginTop: -8, marginBottom: 14 }}>
            Requirements and templates for {profile.program_type === "SHS_WORK_IMMERSION" ? "SHS Work Immersion" : "College OJT"}.
          </p>
          {resources === null ? (
            <p className="helper">Loading…</p>
          ) : resources.length === 0 ? (
            <div className="empty-state">No documents available yet.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {resources.map((r) => (
                <li key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <a href={r.stored_path} target="_blank" rel="noreferrer">{r.title}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
