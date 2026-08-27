import { createFileRoute } from "@tanstack/react-router";
import ResellerDashboard from "@/pages/ResellerDashboard";
import ResellerRoute from "@/components/ResellerRoute";

export const Route = createFileRoute("/reseller/")({
  head: () => ({
    meta: [
      { title: "Reseller Dashboard | Iftin Internet" },
      { name: "description", content: "Track your sales, balance, customers and payouts as an Iftin reseller." },
      { property: "og:title", content: "Reseller Dashboard | Iftin Internet" },
      { property: "og:description", content: "Track your sales, balance, customers and payouts as an Iftin reseller." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ResellerRoute>
      <ResellerDashboard />
    </ResellerRoute>
  );
}
