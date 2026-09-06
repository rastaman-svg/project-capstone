import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function jsonError(detail: string, status: number) {
  return NextResponse.json({ detail }, { status });
}

/** Wrap a route handler body so a thrown AuthError becomes a clean 401,
 *  matching the PHP version's require_admin()/require_student() exits. */
export async function withErrorHandling(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonError(e.message, 401);
    }
    console.error(e);
    return jsonError("Internal server error.", 500);
  }
}
