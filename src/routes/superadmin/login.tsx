import { createFileRoute } from "@tanstack/react-router";
import AdminLogin from "@/pages/AdminLogin";

export const Route = createFileRoute("/superadmin/login")({
  head: () => ({
    meta: [
      { title: "Super Admin Login | Iftin Internet" },
      { name: "description", content: "Secure sign-in for Iftin Internet super administrators." },
      { property: "og:title", content: "Super Admin Login | Iftin Internet" },
      { property: "og:description", content: "Secure sign-in for Iftin Internet super administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminLogin superAdminMode />;
}
