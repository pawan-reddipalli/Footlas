"use client";

import {
  ClerkProvider,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { createContext, useCallback, useContext, useMemo } from "react";

/**
 * One auth interface for the whole app.
 *
 * With NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set, users sign in with Clerk and every API
 * call carries their session token. Without it the app runs in local guest mode: each
 * browser gets a guest id that the API trusts only while it runs with AUTH_MODE=dev.
 */
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const GUEST_KEY = "footlas.guest-id";

type AuthState = {
  mode: "clerk" | "guest";
  ready: boolean;
  signedIn: boolean;
  getHeaders: () => Promise<Record<string, string>>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuthState(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuthState must be used inside <AuthProvider>");
  return state;
}

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getHeaders = useCallback(async () => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [getToken]);
  const value = useMemo<AuthState>(
    () => ({ mode: "clerk", ready: isLoaded, signedIn: !!isSignedIn, getHeaders }),
    [isLoaded, isSignedIn, getHeaders],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function guestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `guest-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return "guest";
  }
}

const guestState: AuthState = {
  mode: "guest",
  ready: true,
  signedIn: true,
  getHeaders: async () => ({ "X-Dev-User": guestId() }),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (CLERK_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <AuthContext.Provider value={guestState}>{children}</AuthContext.Provider>;
}

export function AccountControls() {
  const { mode, ready, signedIn } = useAuthState();
  if (mode === "guest") {
    return (
      <span
        className="rounded-full border border-border px-3 py-1 text-xs text-muted"
        title="Running without Clerk keys: progress is saved for this browser only"
      >
        Guest mode
      </span>
    );
  }
  if (!ready) return null;
  return signedIn ? (
    <UserButton />
  ) : (
    <SignInButton mode="modal">
      <button className="rounded-full bg-pitch px-4 py-1.5 text-sm font-semibold text-white hover:bg-pitch-strong">
        Sign in
      </button>
    </SignInButton>
  );
}

export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-lg font-semibold">{message}</p>
      <p className="text-sm text-muted">
        Your XP, streak and achievements are saved to your account.
      </p>
      <AccountControls />
    </div>
  );
}
