"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, fmtDate, fmtTime, programLabel, stampClass } from "@/lib/client-helpers";

declare global {
  interface Window { QRCode: any; }
}

type TabName = "roster" | "attendance" | "scanner" | "documents" | "settings";

export default function AdminDashboardClient({ initialUsers }: { initialUsers: any[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabName>("roster");
  const [users] = useState<any[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [resources, setResources] = useState<any[]>([]);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadProgram, setUploadProgram] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const qrTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // qrcodejs, loaded from the same CDN the PHP version used — no npm
    // dependency needed for a feature this small.
    if (!window.QRCode) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      document.body.appendChild(s);
    }
  }, []);

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    try { await apiRequest("/api/admin/logout", { method: "POST" }); } catch {}
    router.push("/");
    router.refresh();
  }

  async function loadAttendance() {
    if (attendanceLoaded) return;
    try {
      const rows = await apiRequest("/api/attendance");
      setAttendance(rows);
      setAttendanceLoaded(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadResources() {
    try {
      const rows = await apiRequest("/api/resources");
      setResources(rows);
      setResourcesLoaded(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSettings() {
    if (settings) return;
    try {
      const s = await apiRequest("/api/settings");
      setSettings(s);
    } catch (e) {
      console.error(e);
    }
  }

  function switchTab(t: TabName) {
    setTab(t);
    if (t === "attendance") loadAttendance();
    if (t === "documents") loadResources();
    if (t === "settings") loadSettings();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadMsg({ type: "error", text: "Title and file are required." });
      return;
    }
    setUploadBusy(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("title", uploadTitle.trim());
      if (uploadProgram) form.append("program_type", uploadProgram);
      form.append("file", uploadFile);
      const res = await fetch("/api/resources", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).detail || "Upload failed");
      setUploadMsg({ type: "success", text: "Uploaded." });
      setUploadTitle("");
      setUploadProgram("");
      setUploadFile(null);
      loadResources();
    } catch (err: any) {
      setUploadMsg({ type: "error", text: err.message });
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleDeleteResource(id: number) {
    if (!confirm("Delete this document?")) return;
    try {
      await apiRequest(`/api/resources/${id}`, { method: "DELETE" });
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  }

  function updateSettingsField(field: string, value: string) {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsMsg(null);
    try {
      const updated = await apiRequest("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSettings(updated);
      setSettingsMsg({ type: "success", text: "Settings saved." });
    } catch (err: any) {
      setSettingsMsg({ type: "error", text: err.message });
    } finally {
      setSettingsBusy(false);
    }
  }

  function initials(fullName: string) {
    return fullName.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }

  function downloadQr(studentId: string, fullName: string) {
    if (!window.QRCode || !qrTargetRef.current) {
      alert("QR library still loading — try again in a moment.");
      return;
    }
    const target = qrTargetRef.current;
    target.innerHTML = "";
    const qrSize = 320, quietZone = 32;
    new window.QRCode(target, { text: `${studentId}|${fullName}`, width: qrSize, height: qrSize, correctLevel: 2 });
    setTimeout(() => {
      const sourceCanvas = target.querySelector("canvas");
      if (!sourceCanvas) return;
      const padded = document.createElement("canvas");
      padded.width = qrSize + quietZone * 2;
      padded.height = qrSize + quietZone * 2;
      const ctx = padded.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, padded.width, padded.height);
      ctx.drawImage(sourceCanvas as CanvasImageSource, quietZone, quietZone);
      const a = document.createElement("a");
      a.href = padded.toDataURL("image/png");
      a.download = `${studentId}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 50);
  }

  const filtered = !search.trim()
    ? users
    : users.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.student_id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/images/logo.jpg" alt="ACLC College Daet Campus" />
          <div>
            <div className="title">ACLC College Daet Campus</div>
            <div className="subtitle">Admin Dashboard</div>
          </div>
        </div>
        <nav>
          <a href="#" onClick={handleLogout}>Logout</a>
          <a href="/">Home</a>
        </nav>
      </div>

      <div className="page">
        <div className="page-head"><h1>Dashboard</h1></div>

        <div className="admin-navbar">
          <button className={`nav-tab ${tab === "roster" ? "active" : ""}`} onClick={() => switchTab("roster")}>Students</button>
          <button className={`nav-tab ${tab === "attendance" ? "active" : ""}`} onClick={() => switchTab("attendance")}>Attendance log</button>
          <button className={`nav-tab ${tab === "scanner" ? "active" : ""}`} onClick={() => switchTab("scanner")}>Scanner</button>
          <button className={`nav-tab ${tab === "documents" ? "active" : ""}`} onClick={() => switchTab("documents")}>Documents</button>
          <button className={`nav-tab ${tab === "settings" ? "active" : ""}`} onClick={() => switchTab("settings")}>Settings</button>
        </div>

        <div className="admin-main">
          {tab === "roster" && (
            <div className="student-panel-shell">
              <div className="card">
                <h2>All students</h2>
                <div className="field">
                  <input placeholder="Search name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div style={{ marginTop: 8, maxHeight: 520, overflowY: "auto" }}>
                  {filtered.map((u) => (
                    <div
                      key={u.student_id}
                      className={`student-list-row ${selected?.student_id === u.student_id ? "active" : ""}`}
                      onClick={() => setSelected(u)}
                    >
                      <div>
                        <div>{u.full_name}</div>
                        <div className="sid">{u.student_id}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {users.length === 0 && <div className="empty-state">No students registered yet.</div>}
              </div>

              <div className="card">
                {!selected ? (
                  <div className="empty-state">Select a student from the list to view their info.</div>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div className="avatar-circle">{initials(selected.full_name)}</div>
                      <div>
                        <h2 style={{ marginBottom: 2 }}>{selected.full_name}</h2>
                        <div className="helper" style={{ marginTop: 0 }}>{selected.student_id}</div>
                        <span className={`stamp-badge ${selected.is_active ? "stamp-present" : "stamp-absent"}`}>
                          {selected.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                    </div>
                    <p className="helper" style={{ marginTop: 10 }}>
                      Face photo will appear here once a student completes face enrollment on the scanner.
                    </p>
                    <div className="info-grid">
                      <div className="info-item"><div className="info-label">Email</div><div className="info-value">{selected.email}</div></div>
                      <div className="info-item"><div className="info-label">Program</div><div className="info-value">{programLabel(selected.program_type)}</div></div>
                      <div className="info-item"><div className="info-label">Year level</div><div className="info-value">{selected.year_level}</div></div>
                      <div className="info-item"><div className="info-label">Course / Strand</div><div className="info-value">{selected.course}</div></div>
                      <div className="info-item"><div className="info-label">Section</div><div className="info-value">{selected.section || "—"}</div></div>
                      <div className="info-item"><div className="info-label">Company Adviser</div><div className="info-value">{selected.company_advisor}</div></div>
                      <div className="info-item"><div className="info-label">OJT Start Date</div><div className="info-value">{fmtDate(selected.ojt_start_date)}</div></div>
                      <div className="info-item"><div className="info-label">Required Hours</div><div className="info-value">{Number(selected.total_required_hours).toFixed(1)}</div></div>
                    </div>
                    <button className="secondary" style={{ marginTop: 20 }} onClick={() => downloadQr(selected.student_id, selected.full_name)}>
                      Download QR
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "attendance" && (
            <div className="card">
              <h2>Full attendance ledger</h2>
              <table>
                <thead>
                  <tr><th>Student</th><th>Date</th><th>Shift</th><th>Time in</th><th>Time out</th><th>Hours</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {attendance.map((r, i) => (
                    <tr key={i}>
                      <td>{r.full_name} <span style={{ color: "var(--ink-soft)" }}>({r.student_id})</span></td>
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
              {attendance.length === 0 && <div className="empty-state">No attendance records yet.</div>}
            </div>
          )}

          {tab === "scanner" && (
            <div className="card">
              <h2>Live scanner &amp; face registration</h2>
              <p className="helper" style={{ marginTop: -6 }}>
                Opens in a new tab using your current admin session (cookies carry over automatically — no
                token to pass, unlike the old PHP version).
              </p>
              <div className="role-stack" style={{ marginTop: 10 }}>
                <a className="role-card" href="/scanner" target="_blank">
                  <div className="eyebrow">Kiosk</div>
                  <h3>Open Scanner</h3>
                  <p>Live face TIME-IN and QR TIME-OUT, with a verification panel showing name, section, and adviser.</p>
                </a>
                <a className="role-card" href="/enroll" target="_blank">
                  <div className="eyebrow">Setup</div>
                  <h3>Open Face Registration</h3>
                  <p>Capture 20+ face samples per student and save an averaged descriptor for reliable matching.</p>
                </a>
              </div>
            </div>
          )}

          {tab === "documents" && (
            <div>
              <div className="card">
                <h2>Upload a document</h2>
                {uploadMsg && <div className={uploadMsg.type === "error" ? "error-msg" : "success-msg"}>{uploadMsg.text}</div>}
                <form onSubmit={handleUpload}>
                  <div className="field-row">
                    <div className="field">
                      <label>Title</label>
                      <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>Program (optional — leave blank for both)</label>
                      <select value={uploadProgram} onChange={(e) => setUploadProgram(e.target.value)}>
                        <option value="">Both programs</option>
                        <option value="COLLEGE_OJT">College OJT</option>
                        <option value="SHS_WORK_IMMERSION">SHS Work Immersion</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>File</label>
                    <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
                  </div>
                  <button type="submit" disabled={uploadBusy}>{uploadBusy ? "Uploading…" : "Upload"}</button>
                </form>
              </div>

              <div className="card" style={{ marginTop: 20 }}>
                <h2>All documents</h2>
                <table>
                  <thead><tr><th>Title</th><th>Program</th><th>File</th><th>Uploaded</th><th></th></tr></thead>
                  <tbody>
                    {resources.map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td>
                        <td>{r.program_type ? programLabel(r.program_type) : "Both"}</td>
                        <td><a href={r.stored_path} target="_blank" rel="noreferrer">{r.file_name}</a></td>
                        <td>{fmtDate(r.uploaded_at)}</td>
                        <td><button className="secondary" onClick={() => handleDeleteResource(r.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resourcesLoaded && resources.length === 0 && <div className="empty-state">No documents uploaded yet.</div>}
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="card">
              <h2>Settings</h2>
              {!settings ? (
                <p className="helper">Loading…</p>
              ) : (
                <form onSubmit={handleSaveSettings}>
                  {settingsMsg && <div className={settingsMsg.type === "error" ? "error-msg" : "success-msg"}>{settingsMsg.text}</div>}

                  <div className="field-row">
                    <div className="field">
                      <label>College OJT default hours</label>
                      <input type="number" step="0.5" value={settings.college_ojt_default_hours} onChange={(e) => updateSettingsField("college_ojt_default_hours", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>SHS default hours</label>
                      <input type="number" step="0.5" value={settings.shs_default_hours} onChange={(e) => updateSettingsField("shs_default_hours", e.target.value)} />
                    </div>
                  </div>

                  <p className="helper" style={{ marginTop: 10 }}>TIME-IN windows</p>
                  <div className="field-row">
                    <div className="field"><label>AM start</label><input type="time" value={settings.am_time_in_start} onChange={(e) => updateSettingsField("am_time_in_start", e.target.value)} /></div>
                    <div className="field"><label>AM end</label><input type="time" value={settings.am_time_in_end} onChange={(e) => updateSettingsField("am_time_in_end", e.target.value)} /></div>
                  </div>
                  <div className="field-row">
                    <div className="field"><label>PM start</label><input type="time" value={settings.pm_time_in_start} onChange={(e) => updateSettingsField("pm_time_in_start", e.target.value)} /></div>
                    <div className="field"><label>PM end</label><input type="time" value={settings.pm_time_in_end} onChange={(e) => updateSettingsField("pm_time_in_end", e.target.value)} /></div>
                  </div>

                  <p className="helper" style={{ marginTop: 10 }}>TIME-OUT windows</p>
                  <div className="field-row">
                    <div className="field"><label>AM start</label><input type="time" value={settings.am_time_out_start} onChange={(e) => updateSettingsField("am_time_out_start", e.target.value)} /></div>
                    <div className="field"><label>AM end</label><input type="time" value={settings.am_time_out_end} onChange={(e) => updateSettingsField("am_time_out_end", e.target.value)} /></div>
                  </div>
                  <div className="field-row">
                    <div className="field"><label>PM start</label><input type="time" value={settings.pm_time_out_start} onChange={(e) => updateSettingsField("pm_time_out_start", e.target.value)} /></div>
                    <div className="field"><label>PM end</label><input type="time" value={settings.pm_time_out_end} onChange={(e) => updateSettingsField("pm_time_out_end", e.target.value)} /></div>
                  </div>

                  <button type="submit" disabled={settingsBusy} style={{ marginTop: 10 }}>{settingsBusy ? "Saving…" : "Save settings"}</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <div ref={qrTargetRef} style={{ position: "absolute", left: -9999, top: -9999 }} />
    </div>
  );
}
