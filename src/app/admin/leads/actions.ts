"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { acceptLead, markLeadAsSpam, sendLeadCardToMaster } from "@/application";
import { createTelegramMasterInterface } from "@/infrastructure/telegram";
import { getAdminRepositories } from "../_lib/repositories";

function leadIdFromForm(formData: FormData): string {
  const leadId = formData.get("leadId");
  return z.string().uuid().parse(typeof leadId === "string" ? leadId : "");
}

export async function acceptLeadAction(formData: FormData) {
  const repositories = getAdminRepositories();
  await acceptLead(repositories, {
    leadId: leadIdFromForm(formData),
  });
  revalidatePath("/admin/leads");
}

export async function markLeadAsSpamAction(formData: FormData) {
  const repositories = getAdminRepositories();
  await markLeadAsSpam(repositories, {
    leadId: leadIdFromForm(formData),
  });
  revalidatePath("/admin/leads");
}

export async function sendTelegramLeadCardAction(formData: FormData) {
  const repositories = getAdminRepositories();
  await sendLeadCardToMaster(repositories, createTelegramMasterInterface(), {
    leadId: leadIdFromForm(formData),
  });
  revalidatePath("/admin/leads");
}
