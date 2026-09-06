export const YEAR_LEVELS_BY_PROGRAM: Record<string, string[]> = {
  COLLEGE_OJT: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
  SHS_WORK_IMMERSION: ["Grade 11", "Grade 12"],
};

export function stampClass(status: string): string {
  switch (status) {
    case "PRESENT": return "stamp-present";
    case "INCOMPLETE": return "stamp-incomplete";
    case "ABSENT": return "stamp-absent";
    case "FLAGGED": return "stamp-flagged";
    default: return "stamp-incomplete";
  }
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export function programLabel(pt: string): string {
  if (pt === "COLLEGE_OJT") return "College OJT";
  if (pt === "SHS_WORK_IMMERSION") return "SHS Work Immersion";
  return "Both Programs";
}

/** Thin fetch wrapper — no token headers needed (httpOnly cookies ride
 * along automatically), unlike the PHP version's apiRequest(). */
export async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { ...(options.headers as any) };
  if (!(options.body instanceof FormData) && options.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, { ...options, headers, credentials: "include" });
  let body: any = null;
  try { body = await res.json(); } catch { /* no body */ }

  if (!res.ok) {
    const detail = body?.detail || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return body;
}
