import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Integration test — requires a running server
// Skip in CI unless INTEGRATION_TEST=true
const SKIP = !process.env.INTEGRATION_TEST;

describe.skipIf(SKIP)("REST API Integration", () => {
  const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

  it("GET /health returns healthy status", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("GET /api/v1/projects requires auth", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/projects`);
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/tasks requires auth", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "test", instruction: "hello" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/tasks with valid API key", async () => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) return;

    const res = await fetch(`${BASE_URL}/api/v1/tasks`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toBeDefined();
    expect(Array.isArray(body.tasks)).toBe(true);
  });
});
