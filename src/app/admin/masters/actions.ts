"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  activateTrial,
  assignAiNumberToMaster,
  createMaster,
  CreateMasterCommandSchema,
} from "@/application";
import { TradeTypeSchema } from "@/domain";
import { getAdminRepositories } from "../_lib/repositories";

const CreateMasterFormSchema = CreateMasterCommandSchema.extend({
  tradeType: TradeTypeSchema,
});

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMasterAction(formData: FormData) {
  const repositories = getAdminRepositories();
  const input = CreateMasterFormSchema.parse({
    name: formString(formData, "name"),
    phone: formString(formData, "phone"),
    city: formString(formData, "city") || "Almaty",
    tradeType: formString(formData, "tradeType"),
    telegramChatId: formString(formData, "telegramChatId") || null,
    createTrialSubscription: formData.get("createTrialSubscription") === "on",
  });
  const master = await createMaster(repositories, input);
  revalidatePath("/admin/masters");
  redirect(`/admin/masters/${master.id}`);
}

export async function assignAiNumberAction(formData: FormData) {
  const repositories = getAdminRepositories();
  const input = z
    .object({
      masterId: z.string().uuid(),
      aiNumberId: z.string().uuid().optional(),
    })
    .parse({
      masterId: formString(formData, "masterId"),
      aiNumberId: formString(formData, "aiNumberId") || undefined,
    });
  await assignAiNumberToMaster(repositories, input);
  revalidatePath(`/admin/masters/${input.masterId}`);
  revalidatePath("/admin/numbers");
  redirect(`/admin/masters/${input.masterId}`);
}

export async function activateTrialAction(formData: FormData) {
  const repositories = getAdminRepositories();
  const input = z
    .object({
      masterId: z.string().uuid(),
    })
    .parse({
      masterId: formString(formData, "masterId"),
    });
  await activateTrial(repositories, {
    masterId: input.masterId,
    days: 14,
  });
  revalidatePath(`/admin/masters/${input.masterId}`);
  revalidatePath("/admin/masters");
  redirect(`/admin/masters/${input.masterId}`);
}
