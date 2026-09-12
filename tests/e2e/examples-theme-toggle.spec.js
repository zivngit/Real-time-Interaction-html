// @ts-check
import { test, expect } from "@playwright/test";

const LIGHT_BG = "rgb(247, 251, 255)";
const DARK_BG = "rgb(11, 16, 21)";
const EXAMPLE_PATHS = [
  "/examples/",
  "/examples/embed-viewer.html",
  "/examples/embed-console.html",
  "/examples/embed-both.html",
];

test("example pages provide light/dark theme toggle with persistence", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  for (const path of EXAMPLE_PATHS) {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(path);

    const toggle = page.locator("#examples-theme-toggle");
    await expect(toggle, `theme toggle visible on ${path}`).toBeVisible();
    await expect(toggle, `initial light theme on ${path}`).toHaveText("深色");

    expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe("light");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), path).toBe(LIGHT_BG);

    await toggle.click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe("dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), path).toBe(DARK_BG);
    expect(await page.evaluate(() => localStorage.getItem("examples-theme")), path).toBe("dark");
    await expect(toggle, `toggle label after dark on ${path}`).toHaveText("淺色");

    await page.reload();
    await expect(toggle, `theme toggle persists after reload on ${path}`).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe("dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), path).toBe(DARK_BG);

    await toggle.click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe("light");
    expect(await page.evaluate(() => localStorage.getItem("examples-theme")), path).toBe("light");
  }

  expect(errors).toHaveLength(0);
});
