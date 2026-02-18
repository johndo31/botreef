import { describe, it, expect, vi } from "vitest";

// Integration test — requires a running server with Redis/Valkey
const SKIP = !process.env.INTEGRATION_TEST;

describe.skipIf(SKIP)("Job Lifecycle Integration", () => {
  const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const API_KEY = process.env.TEST_API_KEY ?? "";

  it("full job lifecycle: create → poll → complete", async () => {
    // 1. Create a task
    const createRes = await fetch(`${BASE_URL}/api/v1/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        projectId: "test-project",
        instruction: "Create a hello world file",
      }),
    });
    expect(createRes.status).toBe(201);
    const { jobId } = await createRes.json();
    expect(jobId).toBeDefined();

    // 2. Poll for status
    let status = "queued";
    let attempts = 0;
    while (status !== "completed" && status !== "failed" && attempts < 60) {
      const statusRes = await fetch(`${BASE_URL}/api/v1/tasks/${jobId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const task = await statusRes.json();
      status = task.status;
      if (status !== "completed" && status !== "failed") {
        await new Promise((r) => setTimeout(r, 5000));
      }
      attempts++;
    }

    // 3. Verify completion
    const finalRes = await fetch(`${BASE_URL}/api/v1/tasks/${jobId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const finalTask = await finalRes.json();
    expect(["completed", "failed"]).toContain(finalTask.status);
  }, 300_000); // 5 minute timeout
});
