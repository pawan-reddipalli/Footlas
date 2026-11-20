import { expect, test } from "@playwright/test";

import { answerCurrent, answerFirstOption, answerOnMap, expectLearnCard } from "./helpers";

// Every test gets a fresh browser context, so a fresh guest id and a brand-new player.

test("home dashboard shows the ball, XP and streak", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome to the squad");
  await expect(page.getByTestId("football").first()).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Level 1 progress" })).toBeVisible();
  await expect(page.getByTitle("Daily challenge streak", { exact: true })).toContainText(/^0\s*days$/);
  await expect(page.getByText("Kick-off: 10 questions")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pin collection" })).toBeVisible();
  await expect(page.getByText("Guest mode")).toBeVisible();
});

test("world map: click a country and get a Learn Card", async ({ page }) => {
  await page.goto("/play/map");
  await expect(page.getByRole("heading", { level: 2 })).not.toBeEmpty();
  await expect(page.getByTestId("scoreboard")).toHaveText("0/0");
  await answerOnMap(page);
  await expectLearnCard(page);
  await expect(page.getByText(/^Answer: /)).toBeVisible();
  await expect(page.getByTestId("scoreboard")).toHaveText(/^[01]\/1$/);

  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByTestId("learn-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lock it in" })).toBeDisabled();
});

test("who am I: pick an option and get a Learn Card", async ({ page }) => {
  await page.goto("/play/players");
  await expect(page.getByRole("heading", { name: "Who am I?" })).toBeVisible();
  await expect(page.getByText("Scouting report")).toBeVisible();
  await answerFirstOption(page);
  await expectLearnCard(page);
  // Once answered, the options lock and the right one is marked.
  await expect(page.getByTestId("answer-option").first()).toBeDisabled();
  await expect(page.getByTestId("answer-option").filter({ hasText: "✓" })).toHaveCount(1);
  await expect(page.getByTestId("scoreboard")).toHaveText(/^[01]\/1$/);
});

test("daily challenge: answering moves the match clock on", async ({ page }) => {
  await page.goto("/play/daily");
  await expect(page.getByText("Question 1 of 10")).toBeVisible();
  await expect(page.getByTestId("scoreboard")).toHaveText("0'");
  await answerCurrent(page);
  await expectLearnCard(page);
  await expect(page.getByTestId("scoreboard")).toHaveText("9'");
  await expect(page.getByRole("button", { name: /^Question 1, (correct|missed)$/ })).toBeVisible();

  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByText("Question 2 of 10")).toBeVisible();

  // Progress is saved on the server: a reload resumes at question 2.
  await page.reload();
  await expect(page.getByText("Question 2 of 10")).toBeVisible();
  await expect(page.getByTestId("scoreboard")).toHaveText("9'");
});

test("profile: stats and pin collection render, and the name can change", async ({ page }) => {
  await page.goto("/profile");
  for (const label of ["Questions", "Accuracy", "Map correct", "Players named"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /Pin collection/ })).toContainText(/0\/\d+/);
  const pins = page.getByTestId("pin");
  expect(await pins.count()).toBeGreaterThan(0);
  await expect(pins.and(page.locator('[data-unlocked="true"]'))).toHaveCount(0);

  const name = `e2e_${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Username").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("profile counts answers and unlocks First Kick", async ({ page }) => {
  await page.goto("/play/players");
  // Keep answering until one is right: with four options that takes a few tries at most.
  for (let i = 0; i < 25; i++) {
    await answerFirstOption(page);
    await expectLearnCard(page);
    if ((await page.getByText(/^Unlocked: /).count()) > 0) break;
    await page.getByRole("button", { name: "Next question" }).click();
    await expect(page.getByTestId("learn-card")).toHaveCount(0);
  }
  await expect(page.getByText("Unlocked: First Kick")).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByTestId("pin").and(page.locator('[data-unlocked="true"]'))).toHaveCount(1);
  await expect(page.getByText("Players named", { exact: true })).toBeVisible();
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /Switch to floodlit \(dark\) mode/ }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark"); // the choice is remembered
  await page.getByRole("button", { name: /Switch to matchday \(light\) mode/ }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});
