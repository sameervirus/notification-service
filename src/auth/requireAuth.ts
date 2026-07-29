import type { FastifyReply, FastifyRequest } from "fastify";
import { auditLog } from "../logging/audit.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";

    auditLog({
      eventType: "AUTH_FAIL",
      detail: { reason: message, ip: request.ip, path: request.url },
    });

    return reply.code(401).send({ error: "unauthorized" });
  }
}
