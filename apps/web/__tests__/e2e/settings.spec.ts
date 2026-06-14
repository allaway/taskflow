import { test, expect } from "@playwright/test";

const EMAIL = `settings-e2e-${Date.now()}@example.com`;
const PASSWORD = "testpassword123";

test.beforeAll(async ({ request }) => {
  await request.post("/api/auth/register", {
    data: { name: "Settings Tester", email: EMAIL, password: PASSWORD },
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("email-input").fill(EMAIL);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-button").click();
  await expect(page).toHaveURL(/\/today/);
});

test.describe("Settings", () => {
  test("saves and masks AI API key", async ({ page }) => {
    await page.goto("/settings");

    const apiKeyInput = page.getByTestId("ai-api-key-input");
    await apiKeyInput.fill("sk-ant-api03-testkey123456789");
    await page.getByTestId("save-ai-settings-btn").click();

    await expect(page.getByText(/AI settings saved/i)).toBeVisible({ timeout: 5000 });

    await page.reload();

    const savedValue = await apiKeyInput.inputValue();
    expect(savedValue).toContain("...");
    expect(savedValue).not.toContain("testkey123456789");
  });

  test("saves profile name", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /Profile/i }).click();

    const input = page.getByTestId("profile-name-input");
    await input.fill("Updated Name");
    await page.getByTestId("save-profile-btn").click();

    await expect(page.getByText(/Profile saved/i)).toBeVisible({ timeout: 5000 });
  });
});
