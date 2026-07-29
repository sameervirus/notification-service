import twilio from "twilio";
import { env } from "../../config/env.js";
import type { SmsMessage, SmsProvider, SmsSendResult } from "./SmsProvider.js";

export class TwilioSmsProvider implements SmsProvider {
  private readonly client: twilio.Twilio;

  constructor() {
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const result = await this.client.messages.create({
      to: message.to,
      from: env.TWILIO_FROM_NUMBER,
      body: message.body,
    });

    return { providerMessageId: result.sid };
  }
}
