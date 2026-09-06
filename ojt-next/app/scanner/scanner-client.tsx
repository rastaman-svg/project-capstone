"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { faceapi: any; jsQR: any; }
}

const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";
const FACE_MATCH_THRESHOLD = 0.5;
const SCAN_DEBOUNCE_MS = 15000;
const DETECT_INTERVAL_MS = 400;

type KnownFace = { studentId: string; firstName: string; lastName: string; fullName: string; section: string; advisor: string; descriptor: Float32Array };

export default function ScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Loading face recognition models…");
  const [result, setResult] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const knownRef = useRef<KnownFace[]>([]);
  const lastScanRef = useRef<Record<string, number>>({});
  const busyRef = useRef(false);

  useEffect(() => {
    let stopped = false;

    function loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.body.appendChild(s);
      });
    }

    function euclideanDistance(a: Float32Array, b: Float32Array) {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
      return Math.sqrt(sum);
    }

    function findBestMatch(descriptor: Float32Array) {
      let best: KnownFace | null = null, bestDist = Infinity;
      for (const known of knownRef.current) {
        const d = euclideanDistance(descriptor, known.descriptor);
        if (d < bestDist) { bestDist = d; best = known; }
      }
      return best && bestDist <= FACE_MATCH_THRESHOLD ? best : null;
    }

    function captureSnapshot(): string {
      const video = videoRef.current!;
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.85);
    }

    function debounceOk(studentId: string, actionType: string) {
      const key = `${studentId}:${actionType}`;
      const now = Date.now();
      if (lastScanRef.current[key] && now - lastScanRef.current[key] < SCAN_DEBOUNCE_MS) return false;
      lastScanRef.current[key] = now;
      return true;
    }

    async function postScanEvent(studentId: string, actionType: string, method: string) {
      const res = await fetch("/api/scanner-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, action_type: actionType, method, scanned_at: new Date().toISOString(), device_id: "web-kiosk" }),
      });
      return res.json();
    }

    async function loadKnownFaces() {
      const res = await fetch("/api/face-encodings");
      const rows = await res.json();
      knownRef.current = rows.map((r: any) => ({
        studentId: r.student_id, firstName: r.first_name, lastName: r.last_name, fullName: r.full_name,
        section: r.section, advisor: r.company_advisor, descriptor: new Float32Array(JSON.parse(r.encoding_data)),
      }));
      setStatus(`${knownRef.current.length} face(s) enrolled — scanning…`);
    }

    async function detectLoop() {
      if (stopped) return;
      const video = videoRef.current, overlay = overlayRef.current;
      if (!busyRef.current && video && overlay && video.readyState === 4) {
        busyRef.current = true;
        try {
          const octx = overlay.getContext("2d")!;
          octx.drawImage(video, 0, 0, overlay.width, overlay.height);
          const imgData = octx.getImageData(0, 0, overlay.width, overlay.height);
          const qr = window.jsQR(imgData.data, imgData.width, imgData.height);

          if (qr?.data?.includes("|")) {
            const [studentId] = qr.data.split("|");
            if (debounceOk(studentId, "TIME_OUT")) {
              const snap = captureSnapshot();
              const res = await postScanEvent(studentId, "TIME_OUT", "QR");
              setSnapshot(snap);
              setResult(res);
            }
          } else if (knownRef.current.length) {
            const detection = await window.faceapi
              .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection) {
              const match = findBestMatch(detection.descriptor);
              if (match && debounceOk(match.studentId, "TIME_IN")) {
                const snap = captureSnapshot();
                const res = await postScanEvent(match.studentId, "TIME_IN", "FACE");
                setSnapshot(snap);
                setResult(res);
              }
            }
          }
        } catch (e) {
          console.error("Detection error:", e);
        }
        busyRef.current = false;
      }
      setTimeout(detectLoop, DETECT_INTERVAL_MS);
    }

    async function init() {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js");
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setStatus("Loading enrolled faces…");
        await loadKnownFaces();
      } catch (e) {
        setStatus("Couldn't load face recognition models — check your internet connection.");
        console.error(e);
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.addEventListener("loadedmetadata", () => {
          const overlay = overlayRef.current!;
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
          detectLoop();
        });
      } catch (e) {
        setStatus("Couldn't access the camera — check browser permissions.");
        console.error(e);
      }
    }

    init();
    return () => {
      stopped = true;
      // Without this, the camera stays active (indicator light on, track
      // locked) after navigating away — `stopped` only halts the detection
      // loop, it doesn't touch the MediaStream itself.
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const ok = result?.verification_status === "VERIFIED_SUCCESS";

  return (
    <div style={{ background: "#10131c", minHeight: "100vh" }}>
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/images/logo.jpg" alt="ACLC College Daet Campus" />
          <div>
            <div className="title">Live Scanner</div>
            <div className="subtitle">Face TIME-IN &middot; QR TIME-OUT</div>
          </div>
        </div>
        <nav><a href="/admin">Back to dashboard</a></nav>
      </div>

      <div className="scanner-shell">
        <div style={{ position: "relative", background: "#000", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 5, background: "rgba(0,0,0,0.55)", color: "#fff", padding: "8px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
            {status}
          </div>
          <video ref={videoRef} autoPlay muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        <div style={{ background: "var(--paper)", borderLeft: "1px solid var(--line)", padding: 24, overflowY: "auto" }}>
          <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontSize: 18 }}>Last scan</h2>
          {!result ? (
            <div style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: 40, textAlign: "center" }}>Waiting for a face or QR code…</div>
          ) : (
            <div>
              {ok
                ? <div style={{ background: "#e6f6ea", color: "#1a7431", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 13.5, marginBottom: 14 }}>VERIFIED</div>
                : <div style={{ background: "#fdecea", color: "#b3261e", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 13.5, marginBottom: 14 }}>{result.reason || result.detail || "Not verified"}</div>}
              {snapshot && (
                <img src={snapshot} alt="Captured frame" style={{ width: "100%", aspectRatio: "4/3", borderRadius: "var(--radius)", objectFit: "cover", marginBottom: 16, border: `3px solid ${ok ? "#2ea043" : "#d3383e"}` }} />
              )}
              {ok ? (
                <>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{result.last_name}, {result.first_name}</div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 14 }}>{result.student_id}</div>
                  <div className="verify-row" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}><span style={{ color: "var(--ink-soft)" }}>Section</span><span style={{ fontWeight: 600 }}>{result.section || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}><span style={{ color: "var(--ink-soft)" }}>Company Adviser</span><span style={{ fontWeight: 600 }}>{result.company_advisor || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}><span style={{ color: "var(--ink-soft)" }}>Action</span><span style={{ fontWeight: 600 }}>{result.action_type === "TIME_IN" ? "TIME IN" : "TIME OUT"} — {result.shift} shift</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13.5 }}><span style={{ color: "var(--ink-soft)" }}>Time</span><span style={{ fontWeight: 600 }}>{result.server_timestamp ? new Date(result.server_timestamp.replace(" ", "T")).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>
                </>
              ) : (
                <div style={{ color: "var(--ink-soft)", fontSize: 14 }}>Not verified</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
