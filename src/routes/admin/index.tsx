import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Iftin Internet" },
      { name: "description", content: "Manage orders, devices, SIMs, payments and resellers across the platform." },
      { property: "og:title", content: "Admin Dashboard | Iftin Internet" },
      { property: "og:description", content: "Manage orders, devices, SIMs, payments and resellers across the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminDashboard />;
}
