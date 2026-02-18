import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { validateApiKey } from "../auth/api-key.js";
import { getUserRole, type Role } from "../auth/rbac.js";
import { AuthError } from "../util/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: Role;
  }
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest("userId", undefined);
  app.decorateRequest("userRole", undefined);

  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AuthError("Missing Authorization header");
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AuthError("Invalid Authorization format. Use: Bearer <token>");
    }

    const userId = await validateApiKey(token);
    if (!userId) {
      throw new AuthError("Invalid API key");
    }

    request.userId = userId;
    request.userRole = await getUserRole(userId);
  });
}
