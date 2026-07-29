import type { FastifyJWTOptions } from "@fastify/jwt";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export const jwtPluginOptions: FastifyJWTOptions = {
  secret: { public: env.JWT_PUBLIC_KEY },
  verify: {
    algorithms: ["RS256"],
    allowedIss: env.JWT_ISSUER,
    allowedAud: env.JWT_AUDIENCE,
  },
};
