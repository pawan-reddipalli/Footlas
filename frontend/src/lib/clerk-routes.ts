// Shared by the client (ClerkProvider) and the proxy (clerkMiddleware), so both send
// people to the same pages.
export const SIGN_IN_URL = "/sign-in";
export const SIGN_UP_URL = "/sign-up";

// Pages that need an account. Signed-out visitors are sent to SIGN_IN_URL and come back
// here afterwards. The home page stays public so new visitors can see what Footlas is.
export const PROTECTED_ROUTES = ["/play(.*)", "/profile(.*)"];
