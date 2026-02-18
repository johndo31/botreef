import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { loadConfig } from "../../../src/config/loader.js";

describe("Config Loader", () => {
  const testConfigPath = "/tmp/botreef-test-config.yaml";

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  it("loads defaults when no config file exists", () => {
    const config = loadConfig("/tmp/nonexistent-config.yaml");
    expect(config.server.port).toBe(3000);
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.engine.type).toBe("claude-code");
    expect(config.sandbox.runtime).toBe("runc");
  });

  it("parses a valid YAML config", () => {
    writeFileSync(testConfigPath, `
server:
  port: 4000
  logLevel: debug
engine:
  type: codex
  maxTurns: 100
`);
    const config = loadConfig(testConfigPath);
    expect(config.server.port).toBe(4000);
    expect(config.server.logLevel).toBe("debug");
    expect(config.engine.type).toBe("codex");
    expect(config.engine.maxTurns).toBe(100);
  });

  it("interpolates environment variables", () => {
    process.env.TEST_BOT_TOKEN = "my-secret-token";
    writeFileSync(testConfigPath, `
interfaces:
  telegram:
    enabled: true
    botToken: "\${TEST_BOT_TOKEN}"
`);
    const config = loadConfig(testConfigPath);
    expect(config.interfaces.telegram.botToken).toBe("my-secret-token");
    delete process.env.TEST_BOT_TOKEN;
  });

  it("uses defaults for missing fields", () => {
    writeFileSync(testConfigPath, `
server:
  port: 5000
`);
    const config = loadConfig(testConfigPath);
    expect(config.server.port).toBe(5000);
    expect(config.server.maxConcurrentJobs).toBe(2);
    expect(config.database.path).toBe("./botreef.db");
    expect(config.redis.host).toBe("localhost");
  });

  it("throws on invalid config values", () => {
    writeFileSync(testConfigPath, `
server:
  logLevel: invalid_level
`);
    expect(() => loadConfig(testConfigPath)).toThrow();
  });

  it("supports project definitions", () => {
    writeFileSync(testConfigPath, `
projects:
  myapp:
    repoUrl: git@github.com:user/myapp.git
    defaultBranch: main
    branchStrategy: feature-per-job
    autoPush: true
`);
    const config = loadConfig(testConfigPath);
    expect(config.projects.myapp).toBeDefined();
    expect(config.projects.myapp!.repoUrl).toBe("git@github.com:user/myapp.git");
    expect(config.projects.myapp!.branchStrategy).toBe("feature-per-job");
  });
});
