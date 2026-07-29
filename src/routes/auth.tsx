import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import wordmark from "@/assets/innowrap-wordmark.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Innowrap Dashboard" },
      {
        name: "description",
        content: "Admin sign-in for the Innowrap voice agent leads dashboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const ADMIN_ID = "admin";
const ADMIN_PASS = "Admin@123";
export const ADMIN_FLAG = "innowrap_admin_ok";

function AuthPage() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (id.trim() === ADMIN_ID && pass === ADMIN_PASS) {
      localStorage.setItem(ADMIN_FLAG, "1");
      navigate({ to: "/dashboard", replace: true });
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-secondary px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={wordmark} alt="Innowrap" className="h-12 w-auto" />
          <h1 className="text-lg font-semibold tracking-tight">Leads dashboard</h1>
          <p className="text-xs text-muted-foreground">Admin sign-in</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            required
            placeholder="Username"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
