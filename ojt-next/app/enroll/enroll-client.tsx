"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { faceapi: any; }
}

const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";
const TARGET_CAPTURES = 20;
const CAPTURE_INTERVAL_MS = 500;

export default function EnrollClient({ initialUsers }: { initialUsers: any[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [ringActive, setRingActive] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success" | "helper"; text: string } | null>(null);

  const descriptorsRef = useRef<number[][]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.body.appendChild(s);
      });
    }

    (async () => {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js");
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setModelsReady(true);
      } catch (e) { console.error(e); }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720 } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        setMsg({ type: "error", text: "Couldn't access the camera — check browser permissions." });
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Same fix as scanner-client.tsx: clearing the capture timer doesn't
      // stop the camera itself — without this it stays active after
      // navigating away.
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function resetCapture() {
    descriptorsRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCaptureCount(0);
    setCapturing(false);
    setMsg(null);
  }

  function selectStudent(u: any) {
    setSelected(u);
    resetCapture();
  }

  async function saveAveragedDescriptor(studentId: string) {
    const descs = descriptorsRef.current;
    const dim = descs[0].length;
    const avg = new Array(dim).fill(0);
    for (const d of descs) for (let i = 0; i < dim; i++) avg[i] += d[i];
    for (let i = 0; i < dim; i++) avg[i] /= descs.length;

    setMsg({ type: "helper", text: "Saving…" });
    try {
      const res = await fetch("/api/face-encodings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, encoding: avg, encoding_model: "face_api_js_v1" }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Save failed");
      setMsg({ type: "success", text: `Face registered for ${selected.full_name}.` });
    } catch (e: any) {
      setMsg({ type: "error", text: `Failed to save — ${e.message}` });
    }
  }

  function startCapture() {
    if (!modelsReady) {
      setMsg({ type: "error", text: "Face models are still loading — try again in a moment." });
      return;
    }
    descriptorsRef.current = [];
    setCaptureCount(0);
    setCapturing(true);
    setMsg(null);
    let busy = false;

    timerRef.current = setInterval(async () => {
      const video = videoRef.current;
      // Guards against overlapping calls: face-api.js detection can take
      // longer than CAPTURE_INTERVAL_MS on slower hardware, and setInterval
      // doesn't wait for the previous async tick to finish. Without this,
      // multiple in-flight detections can each independently push a capture
      // and each independently trigger saveAveragedDescriptor once the
      // target is hit, firing duplicate save requests.
      if (busy || !video || video.readyState !== 4) return;
      busy = true;
      try {
        const detection = await window.faceapi
          .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection && descriptorsRef.current.length < TARGET_CAPTURES) {
          descriptorsRef.current.push(Array.from(detection.descriptor as Float32Array));
          setCaptureCount(descriptorsRef.current.length);
          setRingActive(true);
          setTimeout(() => setRingActive(false), 150);

          if (descriptorsRef.current.length >= TARGET_CAPTURES) {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            setCapturing(false);
            await saveAveragedDescriptor(selected.student_id);
          }
        }
      } catch (e) { console.error("Capture error:", e); }
      busy = false;
    }, CAPTURE_INTERVAL_MS);
  }

  const filtered = !search.trim()
    ? initialUsers
    : initialUsers.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.student_id.toLowerCase().includes(search.toLowerCase()));

  const pct = Math.min(100, (captureCount / TARGET_CAPTURES) * 100);

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/images/logo.jpg" alt="ACLC College Daet Campus" />
          <div>
            <div className="title">Face Registration</div>
            <div className="subtitle">Enroll a student for TIME-IN recognition</div>
          </div>
        </div>
        <nav><a href="/admin">Back to dashboard</a></nav>
      </div>

      <div className="page">
        <div className="enroll-shell">
          <div className="card">
            <h2>Select student</h2>
            <div className="field"><input placeholder="Search name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div style={{ marginTop: 8, maxHeight: 480, overflowY: "auto" }}>
              {filtered.map((u) => (
                <div key={u.student_id} className={`student-list-row ${selected?.student_id === u.student_id ? "active" : ""}`} onClick={() => selectStudent(u)}>
                  <div><div>{u.full_name}</div><div className="sid">{u.student_id}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            {!selected ? (
              <div className="empty-state">Select a student on the left to begin face registration.</div>
            ) : (
              <div>
                <h2>{selected.full_name}</h2>
                <p className="helper" style={{ marginTop: -6 }}>{selected.student_id} — {selected.course}{selected.section ? ` — ${selected.section}` : ""}</p>

                <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: "var(--radius)", overflow: "hidden" }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, border: `6px solid ${ringActive ? "#2ea043" : "transparent"}`, borderRadius: "var(--radius)", pointerEvents: "none" }} />
                </div>

                <div style={{ height: 10, background: "var(--paper)", borderRadius: 6, overflow: "hidden", margin: "14px 0" }}>
                  <div style={{ height: "100%", background: "var(--accent)", width: `${pct}%`, transition: "width 0.2s" }} />
                </div>
                <p className="helper">{captureCount} / {TARGET_CAPTURES} captures</p>

                {msg && <div className={msg.type === "error" ? "error-msg" : msg.type === "success" ? "success-msg" : "helper"}>{msg.text}</div>}

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={startCapture} disabled={capturing}>{capturing ? "Capturing…" : "Start capture"}</button>
                  <button className="secondary" onClick={resetCapture}>Reset</button>
                </div>
                <p className="helper" style={{ marginTop: 14 }}>
                  Look at the camera and slowly turn your head slightly left, right, up and down
                  while capturing — varied angles make matching more reliable. Keep good, even lighting.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
