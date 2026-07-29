import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { notificationQueue } from "../queue/notificationQueue.js";
import { auditLog } from "../logging/audit.js";
import { requireAuth } from "../auth/requireAuth.js";

const emailPayloadSchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

const smsPayloadSchema = z.object({
  body: z.string().min(1).max(1600),
});

const e164Phone = z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be an E.164 phone number");

const createNotificationSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("EMAIL"),
    recipient: z.string().email(),
    template: z.string().min(1),
    payload: emailPayloadSchema,
  }),
  z.object({
    channel: z.literal("SMS"),
    recipient: e164Phone,
    template: z.string().min(1),
    payload: smsPayloadSchema,
  }),
]);

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/notifications", async (request, reply) => {
    const parsed = createNotificationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const { channel, recipient, template, payload } = parsed.data;

    const notification = await prisma.notification.create({
      data: { channel, recipient, template, payload },
    });

    await notificationQueue.add(
      "send",
      { notificationId: notification.id },
      { jobId: notification.id }
    );

    auditLog({
      eventType: "SEND_ATTEMPT",
      notificationId: notification.id,
      actor: request.user.sub,
      detail: { channel, template },
    });

    return reply.code(202).send({ id: notification.id, status: notification.status });
  });

  app.get<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    const notification = await prisma.notification.findUnique({
      where: { id: request.params.id },
    });

    if (!notification) {
      return reply.code(404).send({ error: "not_found" });
    }

    return reply.send(notification);
  });
}
