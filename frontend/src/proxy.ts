import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { PROTECTED_ROUTES, SIGN_IN_URL, SIGN_UP_URL } from "@/lib/clerk-routes";

// Clerk runs only when keys are configured; without them the app is in local guest mode.
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const isProtected = createRouteMatcher(PROTECTED_ROUTES);

export default clerkEnabled
  ? clerkMiddleware(
      async (auth, req) => {
        if (isProtected(req)) await auth.protect();
      },
      { signInUrl: SIGN_IN_URL, signUpUrl: SIGN_UP_URL },
    )
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
