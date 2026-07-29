import Fastify, { type FastifyError } from "fastify";
import fastifyJwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { logger } from "./logging/logger.js";
import { jwtPluginOptions } from "./auth/jwt.js";
import { notificationRoutes } from "./routes/notifications.js";

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");

    const statusCode = error.statusCode ?? 500;
    const exposeDetail = env.NODE_ENV !== "production" && statusCode < 500;

    reply.code(statusCode).send({
      error: statusCode >= 500 ? "internal_error" : (error.code ?? "request_error"),
      message: exposeDetail ? error.message : undefined,
    });
  });

  app.register(fastifyJwt, jwtPluginOptions);

  app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        try {
          const decoded = app.jwt.decode<{ sub?: string }>(token);
          if (decoded?.sub) return `sub:${decoded.sub}`;
        } catch {
          // Malformed token: fall through to IP-based limiting. Actual
          // rejection happens in requireAuth, which also audit-logs it.
        }
      }
      return request.ip;
    },
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(notificationRoutes);

  return app;
}
