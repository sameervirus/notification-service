export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsSendResult {
  providerMessageId: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<SmsSendResult>;
}
