import type { Call, Lead, Master } from "@/domain";

export type LeadCardStatus = "ACCEPTED" | "SPAM";

export interface LeadCardDeliveryReceipt {
  chatId: string;
  messageId: string;
}

export interface SendLeadCardInput {
  lead: Lead;
  master: Master;
  call: Call | null;
}

export interface EditLeadCardInput extends SendLeadCardInput {
  chatId: string;
  messageId: string;
  status: LeadCardStatus;
}

export interface AnswerMasterCallbackInput {
  callbackQueryId: string;
  text: string;
  showAlert?: boolean;
}

export interface MasterInterfacePort {
  sendLeadCard(input: SendLeadCardInput): Promise<LeadCardDeliveryReceipt>;
  editLeadCard(input: EditLeadCardInput): Promise<void>;
  answerCallback(input: AnswerMasterCallbackInput): Promise<void>;
}
