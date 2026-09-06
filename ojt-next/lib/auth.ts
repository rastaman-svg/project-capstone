import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-only-insecure-secret");

const ADMIN_COOKIE = "admin_session";
const STUDENT_COOKIE = "student_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours, same working-day scope as a physical kiosk shift

type AdminClaims = { kind: "admin"; adminId: number; username: string };
type StudentClaims = { kind: "student"; userId: number; studentId: string };

async function sign(payload: AdminClaims | StudentClaims): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as T;
  } catch {
    return null;
  }
}

/* ---------- admin ---------- */

export async function createAdminSession(adminId: number, username: string) {
  const token = await sign({ kind: "admin", adminId, username });
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getAdminSession(): Promise<AdminClaims | null> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const claims = await verify<AdminClaims>(token);
  // A validly-signed token isn't necessarily an admin token — a student's
  // own legitimately-issued token, copied into a cookie named
  // "admin_session" (httpOnly blocks page JS from doing this, but browser
  // DevTools' cookie editor can), would otherwise pass this check purely
  // on signature validity. Confirmed exploitable in testing before this
  // fix: a student token accepted here let a non-admin call PUT /api/settings.
  if (!claims || claims.kind !== "admin") return null;
  return claims;
}

export function clearAdminSession() {
  cookies().delete(ADMIN_COOKIE);
}

/** Throws a Response(401) if not authenticated — call at the top of any admin-only route handler. */
export async function requireAdmin(): Promise<AdminClaims> {
  const session = await getAdminSession();
  if (!session) {
    throw new AuthError("Admin login required.");
  }
  return session;
}

/* ---------- student ---------- */

export async function createStudentSession(userId: number, studentId: string) {
  const token = await sign({ kind: "student", userId, studentId });
  cookies().set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getStudentSession(): Promise<StudentClaims | null> {
  const token = cookies().get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  const claims = await verify<StudentClaims>(token);
  if (!claims || claims.kind !== "student") return null;
  return claims;
}

export function clearStudentSession() {
  cookies().delete(STUDENT_COOKIE);
}

export async function requireStudent(): Promise<StudentClaims> {
  const session = await getStudentSession();
  if (!session) {
    throw new AuthError("Student login required.");
  }
  return session;
}

export class AuthError extends Error {}
