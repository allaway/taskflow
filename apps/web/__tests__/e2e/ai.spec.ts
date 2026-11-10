import { test, expect } from "@playwright/test";

const EMAIL = `ai-e2e-${Date.now()}@example.com`;
const PASSWORD = "testpassword123";

test.beforeAll(async ({ request }) => {
  await request.post("/api/auth/register", {
    data: { name: "AI Tester", email: EMAIL, password: PASSWORD },
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("email-input").fill(EMAIL);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-button").click();
  await expect(page).toHaveURL(/\/today/);
});

test.describe("AI features", () => {
  test("generate prompt modal opens and shows generate button", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByTestId("add-task-btn").click();
    await page.getByTestId("task-title-input").fill("Write a React component");
    await page.getByTestId("task-submit-btn").click();
    await expect(page.getByText("Write a React component")).toBeVisible({ timeout: 5000 });

    const card = page.getByTestId("task-card").filter({ hasText: "Write a React component" }).first();
    await card.hover();
    await card.getByTestId("generate-prompt-btn").click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("generate-btn")).toBeVisible();
  });

  test("plan my day button opens schedule modal", async ({ page }) => {
    await page.goto("/today");
    await page.getByTestId("plan-my-day-btn").click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("ai-schedule-btn")).toBeVisible();
  });
});
