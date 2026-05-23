import { z } from "zod";

export const GenerateForwardingInstructionsInputSchema = z.object({
  phoneNumber: z.string().min(1),
});

export type GenerateForwardingInstructionsInput = z.infer<
  typeof GenerateForwardingInstructionsInputSchema
>;

export interface ForwardingInstructions {
  noAnswerCode: string;
  busyCode: string;
  disableAllCode: string;
  shortHumanInstructions: string;
}

export function generateForwardingInstructions(
  input: GenerateForwardingInstructionsInput,
): ForwardingInstructions {
  const parsed = GenerateForwardingInstructionsInputSchema.parse(input);

  return {
    noAnswerCode: `**61*${parsed.phoneNumber}**15#`,
    busyCode: `**67*${parsed.phoneNumber}#`,
    disableAllCode: "##002#",
    shortHumanInstructions:
      "Откройте набор номера и отправьте код для переадресации без ответа. Затем отправьте код для переадресации, когда линия занята. Для отключения всех переадресаций используйте ##002#.",
  };
}
