import { test, expect } from "@playwright/test";

const TEST_EMAIL = `test-e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "E2E Tester";

test.describe("Authentication", () => {
  test("register a new account and sign in", async ({ page }) => {
    await page.goto("/register");
    await page.getByTestId("name-input").fill(TEST_NAME);
    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("register-button").click();

    await expect(page).toHaveURL("/login");

    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("login-button").click();

    await expect(page).toHaveURL(/\/today/);
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("email-input").fill("nobody@example.com");
    await page.getByTestId("password-input").fill("wrongpassword");
    await page.getByTestId("login-button").click();

    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/login/);
  });
});
