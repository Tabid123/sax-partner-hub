import { createFileRoute } from "@tanstack/react-router";
import OrderHistory from "@/pages/OrderHistory";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Order History | Iftin Internet" },
      { name: "description", content: "Review every data bundle you have purchased and its delivery status." },
      { property: "og:title", content: "Order History | Iftin Internet" },
      { property: "og:description", content: "Review every data bundle you have purchased and its delivery status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <OrderHistory />;
}
