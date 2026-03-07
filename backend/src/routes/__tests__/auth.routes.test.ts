import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../../__tests__/helpers/app";
import type { FastifyInstance } from "fastify";

vi.mock("../../middleware/auth", () => ({
  authPreHandler: vi.fn().mockImplementation(async (request: any) => {
    request.projectId = "fs_proj_test";
  }),
}));

describe("Auth Routes", () => {
  let app: FastifyInstance;
  let authService: any;

  beforeEach(async () => {
    authService = {
      createProject: vi.fn(),
      rotateApiKey: vi.fn(),
    };
    app = await buildTestApp({ authService });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/auth/projects/create", () => {
    it("should create project without auth", async () => {
      authService.createProject.mockResolvedValue({
        projectId: "fs_proj_123",
        apiKey: "fs_live_key_abc123",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/projects/create",
        payload: {
          name: "My Project",
          owner_email: "test@example.com",
          platform_fee_wallet: "0xPlatform",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.project_id).toBe("fs_proj_123");
      expect(body.data.api_key).toBe("fs_live_key_abc123");
    });

    it("should return 400 on invalid email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/projects/create",
        payload: {
          name: "My Project",
          owner_email: "not-an-email",
          platform_fee_wallet: "0xPlatform",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return 400 on missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/projects/create",
        payload: { name: "My Project" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/auth/api-keys/rotate", () => {
    it("should rotate API key with auth", async () => {
      authService.rotateApiKey.mockResolvedValue({
        apiKeyId: "fs_key_new",
        apiKey: "fs_live_key_new123",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/api-keys/rotate",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: { label: "rotated" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.api_key_id).toBe("fs_key_new");
    });
  });
});
