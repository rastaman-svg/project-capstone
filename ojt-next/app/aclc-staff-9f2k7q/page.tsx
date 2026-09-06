"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-helpers";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="bg-photo bg-admin">
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/images/logo.jpg" alt="ACLC College Daet Campus" />
          <div>
            <div className="title">ACLC College Daet Campus</div>
            <div className="subtitle">Staff Access</div>
          </div>
        </div>
        <nav><a href="/">Home</a></nav>
      </div>

      <div className="page" style={{ maxWidth: 420 }}>
        <div className="page-head">
          <h1>Staff sign in</h1>
          <p>This page isn&apos;t linked anywhere — bookmark it.</p>
        </div>

        <div className="card">
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Username</label>
              <input required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="helper" style={{ marginTop: 16 }}>
            First time setting up? See README.md for how to set the admin password from the command line.
          </p>
        </div>
      </div>
    </div>
  );
}
