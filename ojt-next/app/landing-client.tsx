"use client";

import { apiRequest } from "@/lib/client-helpers";
import { useRouter } from "next/navigation";

export default function LandingClient({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    try { await apiRequest("/api/student/logout", { method: "POST" }); } catch {}
    router.refresh();
  }

  return (
    <div className="bg-photo bg-index">
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/images/logo.jpg" alt="ACLC College Daet Campus" />
          <div>
            <div className="title">ACLC College Daet Campus</div>
            <div className="subtitle">OJT &amp; Work Immersion Attendance System</div>
          </div>
        </div>
        <nav>
          {loggedIn ? (
            <a href="#" onClick={handleLogout}>Logout</a>
          ) : (
            <a href="/student-login">Login</a>
          )}
          <a href="/" className="active">Home</a>
        </nav>
      </div>

      <div className="page">
        <div className="index-hero">
          <div className="index-hero-text">
            <h1>Welcome back.</h1>
            <p>
              Track your OJT and Work Immersion hours, review your attendance,
              and stay on top of your requirements — all in one place for
              ACLC College Daet Campus students.
            </p>
            <div style={{ marginTop: 20 }}>
              {loggedIn ? (
                <a className="btn" href="/student" style={{ display: "inline-flex" }}>My Attendance</a>
              ) : (
                <a className="btn" href="/student-login" style={{ display: "inline-flex" }}>Sign in / Register</a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
