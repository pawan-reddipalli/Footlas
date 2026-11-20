import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests for every screen, in guest mode (no Clerk keys).
 *
 * Not part of CI or `npm run build`. Run them with `./scripts/feature-tests.sh frontend`
 * from the repo root, which starts the API and the web app on spare ports first. To run
 * against servers you started yourself: `E2E_BASE_URL=http://localhost:3100 npm run test:e2e`.
 *
 * PW_CHROMIUM_PATH points Playwright at a Chromium binary that's already installed (for
 * sandboxes where `npx playwright install` isn't possible). Leave it unset to use the
 * browser Playwright installs.
 */
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "off",
    colorScheme: "light",
    viewport: { width: 1280, height: 900 },
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
