"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createValueReport } from "@/application";
import { getAdminRepositories } from "../_lib/repositories";

export async function createValueReportAction(formData: FormData) {
  const input = z
    .object({
      masterId: z.string().uuid(),
      periodStart: z.string().min(1),
      periodEnd: z.string().min(1),
    })
    .parse({
      masterId: formData.get("masterId"),
      periodStart: formData.get("periodStart"),
      periodEnd: formData.get("periodEnd"),
    });
  await createValueReport(getAdminRepositories(), input);
  revalidatePath("/admin/reports");
}
