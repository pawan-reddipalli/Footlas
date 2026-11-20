import type { Metadata } from "next";

import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = { title: "Create your account · Footlas" };

export default function SignUpPage() {
  return <AuthPage kind="sign-up" />;
}
