import { prisma } from "../db/prisma.js";
import { logger } from "./logger.js";
import type { AuditEventType } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";

interface AuditLogInput {
  eventType: AuditEventType;
  notificationId?: string;
  actor?: string;
  detail: Record<string, unknown>;
}

export function auditLog(input: AuditLogInput): void {
  logger.info({ audit: true, ...input }, "audit_event");

  prisma.auditLog
    .create({
      data: {
        eventType: input.eventType,
        notificationId: input.notificationId,
        actor: input.actor,
        detail: input.detail as Prisma.InputJsonValue,
      },
    })
    .catch((err) => {
      logger.error({ err, input }, "Failed to persist audit log entry");
    });
}
