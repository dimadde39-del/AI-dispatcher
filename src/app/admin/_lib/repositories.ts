import { createSupabaseRepositoryContext } from "@/infrastructure/db";

export function getAdminRepositories() {
  return createSupabaseRepositoryContext();
}
