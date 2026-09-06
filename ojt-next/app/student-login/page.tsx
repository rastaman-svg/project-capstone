"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, YEAR_LEVELS_BY_PROGRAM } from "@/lib/client-helpers";

export default function StudentLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // register state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [programType, setProgramType] = useState("COLLEGE_OJT");
  const [yearLevel, setYearLevel] = useState(YEAR_LEVELS_BY_PROGRAM.COLLEGE_OJT[0]);
  const [courses, setCourses] = useState<string[]>([]);
  const [course, setCourse] = useState("");
  const [courseOther, setCourseOther] = useState("");
  const [section, setSection] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [regError, setRegError] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [courseHelper, setCourseHelper] = useState("");

  useEffect(() => {
    setYearLevel(YEAR_LEVELS_BY_PROGRAM[programType][0]);
    loadCourses(programType);
  }, [programType]);

  async function loadCourses(pt: string) {
    setCourse("");
    setCourseHelper("");
    try {
      const { courses: list } = await apiRequest(`/api/courses?program_type=${encodeURIComponent(pt)}`);
      setCourses(list);
      if (!list.length) {
        setCourse("__other__");
        setCourseHelper("No courses/strands on file yet — type yours below.");
      } else {
        setCourse(list[0]);
      }
    } catch {
      setCourses([]);
      setCourse("__other__");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      await apiRequest("/api/student/login", { method: "POST", body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setLoginError(err.message);
      setLoginBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");

    const finalCourse = course === "__other__" ? courseOther.trim() : course;
    if (!finalCourse) {
      setRegError("Please select or type your course/strand.");
      return;
    }

    setRegBusy(true);
    try {
      await apiRequest("/api/student/register", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          program_type: programType,
          year_level: yearLevel,
          course: finalCourse,
          section: section.trim() || undefined,
          company_advisor: advisor.trim(),
          ojt_start_date: startDate,
        }),
      });
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setRegError(err.message);
      setRegBusy(false);
    }
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
        <nav><a href="/">Home</a></nav>
      </div>

      <div className="page" style={{ maxWidth: 480 }}>
        <div className="page-head">
          <h1>Student portal</h1>
          <p>Sign in to view your attendance, or create an account if this is your first time.</p>
        </div>

        <div className="card">
          <div className="tabs">
            <button type="button" className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Sign in</button>
            <button type="button" className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Create account</button>
          </div>

          {tab === "login" && (
            <div>
              {loginError && <div className="error-msg">{loginError}</div>}
              <form onSubmit={handleLogin}>
                <div className="field">
                  <label>Email</label>
                  <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                <button type="submit" disabled={loginBusy} style={{ width: "100%", justifyContent: "center" }}>
                  {loginBusy ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          )}

          {tab === "register" && (
            <div>
              {regError && <div className="error-msg">{regError}</div>}
              <form onSubmit={handleRegister}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>First name</label>
                    <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Last name</label>
                    <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" required minLength={8} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                  <div className="helper">At least 8 characters.</div>
                </div>
                <div className="field">
                  <label>Program</label>
                  <select value={programType} onChange={(e) => setProgramType(e.target.value)}>
                    <option value="COLLEGE_OJT">College OJT</option>
                    <option value="SHS_WORK_IMMERSION">SHS Work Immersion</option>
                  </select>
                </div>
                <div className="field">
                  <label>Year level</label>
                  <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}>
                    {YEAR_LEVELS_BY_PROGRAM[programType].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Course / Strand</label>
                  <select value={course} onChange={(e) => setCourse(e.target.value)}>
                    {courses.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__other__">Other (type below)</option>
                  </select>
                  {course === "__other__" && (
                    <input placeholder="Type your course/strand" style={{ marginTop: 8 }} value={courseOther} onChange={(e) => setCourseOther(e.target.value)} />
                  )}
                  {courseHelper && <div className="helper">{courseHelper}</div>}
                </div>
                <div className="field">
                  <label>Section <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>(optional)</span></label>
                  <input placeholder="e.g. BSIT-3A" value={section} onChange={(e) => setSection(e.target.value)} />
                </div>
                <div className="field">
                  <label>Company Adviser</label>
                  <input required value={advisor} onChange={(e) => setAdvisor(e.target.value)} />
                </div>
                <div className="field">
                  <label>OJT Start Date</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <button type="submit" disabled={regBusy} style={{ width: "100%", justifyContent: "center" }}>
                  {regBusy ? "Creating account…" : "Create account"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
