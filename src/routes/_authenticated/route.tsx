import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("innowrap_admin_ok") !== "1") {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
