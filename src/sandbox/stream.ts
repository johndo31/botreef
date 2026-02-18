import type { Duplex } from "node:stream";
import { logger } from "../util/logger.js";

export interface DemuxedOutput {
  stdout: string;
  stderr: string;
}

export function demuxStream(
  stream: Duplex,
  onStdout?: (data: string) => void,
  onStderr?: (data: string) => void,
): Promise<DemuxedOutput> {
  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => {
      // Docker multiplexed stream format:
      // [stream_type(1)][0(3)][size(4)][payload(size)]
      let offset = 0;
      while (offset < chunk.length) {
        if (offset + 8 > chunk.length) break;

        const streamType = chunk[offset]!;
        const size = chunk.readUInt32BE(offset + 4);
        const payload = chunk.subarray(offset + 8, offset + 8 + size);
        const text = payload.toString("utf8");

        if (streamType === 1) {
          stdout.push(payload);
          onStdout?.(text);
        } else if (streamType === 2) {
          stderr.push(payload);
          onStderr?.(text);
        }

        offset += 8 + size;
      }
    });

    stream.on("end", () => {
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });

    stream.on("error", (err) => {
      logger.error({ err }, "Stream error");
      reject(err);
    });
  });
}
