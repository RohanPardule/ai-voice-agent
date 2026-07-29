import { createServerFn } from "@tanstack/react-start";

export const listLeads = createServerFn({ method: "GET" }).handler(async () => {
  const { listAllLeads } = await import("@/integrations/firebase/db");
  const leads = await listAllLeads();
  return { leads };
});

export const listFeedbacks = createServerFn({ method: "GET" }).handler(async () => {
  const { listAllFeedbacks } = await import("@/integrations/firebase/db");
  const feedbacks = await listAllFeedbacks();
  return { feedbacks };
});

export const deleteLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { id?: string };
    if (!d?.id) throw new Error("id required");
    return { id: d.id };
  })
  .handler(async ({ data }) => {
    const { deleteLeadById } = await import("@/integrations/firebase/db");
    await deleteLeadById(data.id);
    return { ok: true };
  });
