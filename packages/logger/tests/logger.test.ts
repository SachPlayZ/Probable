import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, withRequestId } from "../src/index.js";

function collectingStream(): { stream: Writable; output: () => string } {
  let buffer = "";
  const stream = new Writable({
    write(chunk, _enc, callback) {
      buffer += chunk.toString();
      callback();
    },
  });
  return { stream, output: () => buffer };
}

describe("createLogger", () => {
  it("redacts sensitive fields instead of logging them raw", () => {
    const { stream, output } = collectingStream();
    const logger = createLogger({ level: "info", service: "test", destination: stream });

    logger.info({ headers: { authorization: "Bearer secret-token" } }, "test event");

    expect(output()).not.toContain("secret-token");
    expect(output()).toContain("[redacted]");
  });

  it("binds a request ID via a child logger", () => {
    const { stream, output } = collectingStream();
    const logger = createLogger({ level: "info", service: "test", destination: stream });

    const child = withRequestId(logger, "req_123");
    child.info("hello");

    expect(output()).toContain("req_123");
  });
});
