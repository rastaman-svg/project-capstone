import { getStudentSession } from "@/lib/auth";
import LandingClient from "./landing-client";

export default async function HomePage() {
  const session = await getStudentSession();
  return <LandingClient loggedIn={!!session} />;
}
