import { describe, it, expect } from "vitest";
import { broadcastToProject, getProjectConnectionCount } from "../index";

describe("WebSocket Event Bus", () => {
  describe("broadcastToProject", () => {
    it("should not throw when no clients are connected", () => {
      expect(() => {
        broadcastToProject("proj_nonexistent", "test_event", { foo: "bar" });
      }).not.toThrow();
    });

    it("should return 0 connections for unknown project", () => {
      expect(getProjectConnectionCount("proj_unknown")).toBe(0);
    });
  });
});
