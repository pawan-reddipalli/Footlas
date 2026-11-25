"use client";

import { ClerkProvider, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useMemo } from "react";

import { SIGN_IN_URL, SIGN_UP_URL } from "@/lib/clerk-routes";

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
      <ClerkProvider
        publishableKey={CLERK_KEY}
        signInUrl={SIGN_IN_URL}
        signUpUrl={SIGN_UP_URL}
        afterSignOutUrl="/"
      >
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <AuthContext.Provider value={guestState}>{children}</AuthContext.Provider>;
}

export function AccountControls({ showSignUp = false }: { showSignUp?: boolean }) {
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
  if (signedIn) return <UserButton />;
  // Redirect mode opens the /sign-in and /sign-up pages and returns here afterwards.
  return (
    <div className="flex items-center gap-2">
      {showSignUp && (
        <SignUpButton>
          <button className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold hover:border-pitch">
            Create account
          </button>
        </SignUpButton>
      )}
      <SignInButton>
        <button className="rounded-full bg-pitch px-4 py-1.5 text-sm font-semibold text-on-pitch hover:bg-pitch-strong">
          Sign in
        </button>
      </SignInButton>
    </div>
  );
}

export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="sticker mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
      <p className="font-display text-3xl leading-none font-black uppercase">{message}</p>
      <p className="text-sm text-muted">
        Your XP, streak and achievements are saved to your account.
      </p>
      <AccountControls showSignUp />
    </div>
  );
}
