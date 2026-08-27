import { createFileRoute } from "@tanstack/react-router";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";

export const Route = createFileRoute("/superadmin/")({
  head: () => ({
    meta: [
      { title: "Super Admin | Iftin Internet" },
      { name: "description", content: "Manage tenants, subscriptions and platform-level settings." },
      { property: "og:title", content: "Super Admin | Iftin Internet" },
      { property: "og:description", content: "Manage tenants, subscriptions and platform-level settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <SuperAdminDashboard />;
}
