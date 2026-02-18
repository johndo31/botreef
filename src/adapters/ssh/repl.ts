import type { ServerChannel } from "ssh2";
import type { AdapterDependencies } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";

export class SshRepl {
  public userId: string;
  private stream: ServerChannel | null = null;
  private deps: AdapterDependencies;
  private buffer = "";

  constructor(username: string, deps: AdapterDependencies) {
    this.userId = username;
    this.deps = deps;
  }

  attach(stream: ServerChannel): void {
    this.stream = stream;
    this.writePrompt();

    stream.on("data", (data: Buffer) => {
      const char = data.toString("utf8");

      if (char === "\r" || char === "\n") {
        stream.write("\r\n");
        this.processLine(this.buffer.trim());
        this.buffer = "";
        this.writePrompt();
      } else if (char === "\x7f" || char === "\b") {
        // Backspace
        if (this.buffer.length > 0) {
          this.buffer = this.buffer.slice(0, -1);
          stream.write("\b \b");
        }
      } else if (char === "\x03") {
        // Ctrl+C
        this.buffer = "";
        stream.write("^C\r\n");
        this.writePrompt();
      } else if (char === "\x04") {
        // Ctrl+D — exit
        stream.write("\r\nGoodbye!\r\n");
        stream.close();
      } else {
        this.buffer += char;
        stream.write(char);
      }
    });
  }

  private writePrompt(): void {
    this.stream?.write("\x1b[36mbotreef>\x1b[0m ");
  }

  private async processLine(line: string): Promise<void> {
    if (!line) return;

    if (line === "help") {
      this.write(
        "Commands:\r\n" +
        "  <project> <instruction>  — Submit a coding task\r\n" +
        "  status <jobId>           — Check job status\r\n" +
        "  projects                 — List projects\r\n" +
        "  help                     — Show this help\r\n" +
        "  exit / Ctrl+D            — Disconnect\r\n",
      );
      return;
    }

    if (line === "exit" || line === "quit") {
      this.write("Goodbye!\r\n");
      this.stream?.close();
      return;
    }

    if (line === "projects") {
      this.write("Use the REST API or Web UI to manage projects.\r\n");
      return;
    }

    // Parse: <projectId> <instruction>
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) {
      this.write("Usage: <project> <instruction>\r\n");
      return;
    }

    const projectId = line.slice(0, spaceIdx);
    const instruction = line.slice(spaceIdx + 1);

    const message: InboundMessage = {
      id: generateId(),
      channel: "ssh",
      userId: this.userId,
      userName: this.userId,
      projectId,
      instruction,
      timestamp: new Date(),
    };

    try {
      const jobId = await this.deps.submitMessage(message);
      this.write(`\x1b[32mJob created: ${jobId}\x1b[0m\r\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.write(`\x1b[31mError: ${msg}\x1b[0m\r\n`);
    }
  }

  write(text: string): void {
    this.stream?.write(text);
  }

  writeEvent(event: TaskEvent): void {
    switch (event.type) {
      case "task:output":
        this.write(event.data.output ?? "");
        break;
      case "task:completed":
        this.write(`\r\n\x1b[32m✓ Task completed\x1b[0m`);
        if (event.data.prUrl) this.write(` — PR: ${event.data.prUrl}`);
        this.write("\r\n");
        break;
      case "task:failed":
        this.write(`\r\n\x1b[31m✗ Task failed: ${event.data.error}\x1b[0m\r\n`);
        break;
      case "task:approval_required":
        this.write(`\r\n\x1b[33m⏳ Approval required for branch ${event.data.branch}\x1b[0m\r\n`);
        break;
    }
  }

  close(): void {
    this.stream?.close();
    this.stream = null;
  }
}
