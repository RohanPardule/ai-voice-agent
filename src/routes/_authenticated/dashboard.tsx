import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listLeads, listFeedbacks, deleteLead } from "@/lib/dashboard.functions";
import { LogOut, RefreshCw, Mic, MessageSquare, Users, UserX } from "lucide-react";
import wordmark from "@/assets/innowrap-wordmark.png";
import icon from "@/assets/innowrap-icon.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Leads Dashboard — Innowrap" },
      {
        name: "description",
        content: "Captured leads and feedback from Innowrap's AI voice agent conversations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Lead = {
  id: string;
  session_id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  requirements: string | null;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  created_at: string;
  updated_at: string;
};

type Feedback = {
  id: string;
  session_id: string | null;
  name: string | null;
  email: string | null;
  rating: number | null;
  message: string | null;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const fetchLeads = useServerFn(listLeads);
  const fetchFeedbacks = useServerFn(listFeedbacks);
  const removeLead = useServerFn(deleteLead);

  const [tab, setTab] = useState<"leads" | "anon" | "feedback">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([fetchLeads(), fetchFeedbacks()]);
      setLeads((a.leads ?? []) as unknown as Lead[]);
      setFeedbacks((b.feedbacks ?? []) as unknown as Feedback[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fetchLeads, fetchFeedbacks]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, [load]);

  function handleSignOut() {
    localStorage.removeItem("innowrap_admin_ok");
    navigate({ to: "/auth", replace: true });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;
    try {
      await removeLead({ data: { id } });
      setSelected(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={icon} alt="" className="h-9 w-9 rounded-md" />
            <img src={wordmark} alt="Innowrap" className="hidden h-8 w-auto sm:block" />
            <div className="border-l border-border pl-3 text-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Dashboard</p>
              <p className="font-medium">Voice agent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Mic className="h-4 w-4" /> Agent
            </Link>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {(() => {
          const isQualified = (l: Lead) => !!(l.name || l.email || l.phone);
          const qualified = leads.filter(isQualified);
          const anonymous = leads.filter((l) => !isQualified(l));
          const currentList = tab === "anon" ? anonymous : qualified;
          return (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Qualified leads" value={qualified.length} />
                <Stat label="Anonymous" value={anonymous.length} />
                <Stat label="Feedbacks" value={feedbacks.length} />
                <Stat
                  label="Today"
                  value={
                    leads.filter(
                      (l) =>
                        new Date(l.created_at).toDateString() === new Date().toDateString(),
                    ).length
                  }
                />
              </div>

              <div className="mb-4 inline-flex rounded-md border border-border bg-card p-1 text-sm">
                <button
                  onClick={() => setTab("leads")}
                  className={`inline-flex items-center gap-2 rounded px-3 py-1.5 ${
                    tab === "leads" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Users className="h-4 w-4" /> Leads ({qualified.length})
                </button>
                <button
                  onClick={() => setTab("anon")}
                  className={`inline-flex items-center gap-2 rounded px-3 py-1.5 ${
                    tab === "anon" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <UserX className="h-4 w-4" /> Anonymous ({anonymous.length})
                </button>
                <button
                  onClick={() => setTab("feedback")}
                  className={`inline-flex items-center gap-2 rounded px-3 py-1.5 ${
                    tab === "feedback"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <MessageSquare className="h-4 w-4" /> Feedback ({feedbacks.length})
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {(tab === "leads" || tab === "anon") && (
                <div className="rounded-lg border border-border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">When</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Company</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Project</th>
                          <th className="px-4 py-3">Budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                              Loading…
                            </td>
                          </tr>
                        )}
                        {!loading && currentList.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                              {tab === "anon" ? "No anonymous sessions." : "No leads yet."}
                            </td>
                          </tr>
                        )}
                        {currentList.map((lead) => (
                          <tr
                            key={lead.id}
                            onClick={() => setSelected(lead)}
                            className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {new Date(lead.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-medium">{lead.name ?? "—"}</td>
                            <td className="px-4 py-3">{lead.company ?? "—"}</td>
                            <td className="px-4 py-3">{lead.email ?? "—"}</td>
                            <td className="px-4 py-3">{lead.phone ?? "—"}</td>
                            <td className="px-4 py-3">{lead.project_type ?? "—"}</td>
                            <td className="px-4 py-3">{lead.budget ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "feedback" && (
                <div className="rounded-lg border border-border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">When</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Rating</th>
                          <th className="px-4 py-3">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!loading && feedbacks.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                              No feedback yet.
                            </td>
                          </tr>
                        )}
                        {feedbacks.map((f) => (
                          <tr key={f.id} className="border-b border-border last:border-0">
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {new Date(f.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-medium">{f.name ?? "—"}</td>
                            <td className="px-4 py-3">{f.email ?? "—"}</td>
                            <td className="px-4 py-3">
                              {f.rating != null
                                ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating)
                                : "—"}
                            </td>
                            <td className="px-4 py-3">{f.message ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </main>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.name ?? "Unnamed lead"}</h2>
                <p className="text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(selected.id)}
                className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Company" value={selected.company} />
              <Field label="Email" value={selected.email} />
              <Field label="Phone" value={selected.phone} />
              <Field label="Industry" value={selected.industry} />
              <Field label="Project" value={selected.project_type} />
              <Field label="Budget" value={selected.budget} />
              <Field label="Timeline" value={selected.timeline} />
            </div>

            {selected.requirements && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Requirements
                </p>
                <p className="mt-1 text-sm">{selected.requirements}</p>
              </div>
            )}

            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Transcript
              </p>
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                {(selected.transcript ?? []).map((m, i) => (
                  <div key={i}>
                    <span className="font-medium text-muted-foreground">
                      {m.role === "user" ? "Caller" : "Agent"}:
                    </span>{" "}
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value ?? "—"}</p>
    </div>
  );
}
