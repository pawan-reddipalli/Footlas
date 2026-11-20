import { expect, type Page } from "@playwright/test";

/** Brazil's ISO numeric id: a big country that's easy to hit in the middle. */
export const BRAZIL = "076";

/** Click a country on the world map, then lock the answer in. */
export async function answerOnMap(page: Page, mapId = BRAZIL) {
  await page.locator(`svg[aria-label="World map"] path[data-map-id="${mapId}"]`).click();
  const lock = page.getByRole("button", { name: "Lock it in" });
  await expect(lock).toBeEnabled();
  await lock.click();
}

/** Pick the first option of a "Who Am I?" question. */
export async function answerFirstOption(page: Page) {
  const options = page.getByTestId("answer-option");
  await expect(options).toHaveCount(4);
  await options.first().click();
}

/** Answer whatever question is on screen, map or multiple choice. */
export async function answerCurrent(page: Page) {
  const map = page.locator('svg[aria-label="World map"]');
  const option = page.getByTestId("answer-option").first();
  await expect(map.or(option)).toBeVisible();
  if (await map.isVisible()) await answerOnMap(page);
  else await answerFirstOption(page);
}

/** The Learn Card that follows every answer. */
export async function expectLearnCard(page: Page) {
  const card = page.getByTestId("learn-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("Learn Card")).toBeVisible();
  await expect(card.locator("h3")).not.toBeEmpty();
}
