import { test, expect } from "@playwright/test";

const EMAIL = `tasks-e2e-${Date.now()}@example.com`;
const PASSWORD = "testpassword123";

test.beforeAll(async ({ request }) => {
  await request.post("/api/auth/register", {
    data: { name: "Task Tester", email: EMAIL, password: PASSWORD },
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("email-input").fill(EMAIL);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-button").click();
  await expect(page).toHaveURL(/\/today/);
});

test.describe("Task management", () => {
  test("create a task and see it in inbox", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByTestId("add-task-btn").click();
    await page.getByTestId("task-title-input").fill("Buy groceries");
    await page.getByTestId("task-submit-btn").click();

    await expect(page.getByTestId("task-list")).toContainText("Buy groceries", { timeout: 5000 });
  });

  test("complete a task", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByTestId("add-task-btn").click();
    await page.getByTestId("task-title-input").fill("Task to complete");
    await page.getByTestId("task-submit-btn").click();

    await expect(page.getByText("Task to complete")).toBeVisible({ timeout: 5000 });

    const card = page.getByTestId("task-card").filter({ hasText: "Task to complete" }).first();
    await card.getByTestId("task-complete-btn").click();
    await expect(page.getByTestId("task-card").filter({ hasText: "Task to complete" })).toHaveCount(0, { timeout: 5000 });
  });
});
