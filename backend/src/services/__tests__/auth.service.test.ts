import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../auth.service";

vi.mock("../../db/client", () => {
  const mockDb = Object.assign(vi.fn().mockResolvedValue([]), {
    json: (v: any) => v,
  });
  return { db: mockDb };
});

vi.mock("../../utils/id-generator", () => ({
  generateId: {
    project: vi.fn().mockReturnValue("fs_proj_test123"),
    apiKey: vi.fn().mockReturnValue("fs_key_test123"),
    liveApiKey: vi.fn().mockReturnValue("fs_live_key_test12345678901"),
  },
}));

vi.mock("../../utils/crypto", () => ({
  hashApiKey: vi.fn().mockReturnValue("hashed_key_123"),
}));

import { db } from "../../db/client";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe("createProject", () => {
    it("should create a project and return API key", async () => {
      const result = await service.createProject({
        name: "My Project",
        ownerEmail: "test@example.com",
        platformFeeWallet: "0xPlatform",
      });

      expect(result.projectId).toBe("fs_proj_test123");
      expect(result.apiKey).toBe("fs_live_key_test12345678901");
      expect(db).toHaveBeenCalledTimes(2); // project + api key
    });
  });

  describe("rotateApiKey", () => {
    it("should deactivate old keys and create new one", async () => {
      const result = await service.rotateApiKey(
        "fs_proj_test123",
        "rotated-key",
      );

      expect(result.apiKeyId).toBe("fs_key_test123");
      expect(result.apiKey).toBe("fs_live_key_test12345678901");
      expect(db).toHaveBeenCalledTimes(2); // deactivate old + create new
    });
  });
});
