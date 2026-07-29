import { SmtpEmailProvider } from "./email/SmtpEmailProvider.js";
import { TwilioSmsProvider } from "./sms/TwilioSmsProvider.js";
import type { NotificationChannel } from "../generated/prisma/enums.js";

const emailProvider = new SmtpEmailProvider();
const smsProvider = new TwilioSmsProvider();

export interface DispatchResult {
  providerMessageId: string;
  providerUsed: string;
}

export async function dispatchNotification(
  channel: NotificationChannel,
  recipient: string,
  payload: unknown
): Promise<DispatchResult> {
  switch (channel) {
    case "EMAIL": {
      const emailPayload = payload as { subject: string; html: string; text?: string };
      const result = await emailProvider.send({
        to: recipient,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
      });
      return { providerMessageId: result.providerMessageId, providerUsed: "smtp" };
    }
    case "SMS": {
      const smsPayload = payload as { body: string };
      const result = await smsProvider.send({
        to: recipient,
        body: smsPayload.body,
      });
      return { providerMessageId: result.providerMessageId, providerUsed: "twilio" };
    }
    default: {
      const exhaustiveCheck: never = channel;
      throw new Error(`Unsupported channel: ${exhaustiveCheck}`);
    }
  }
}
