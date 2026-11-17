import type { Metadata } from "next";

import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = { title: "Sign in · Footlas" };

export default function SignInPage() {
  return <AuthPage kind="sign-in" />;
}
