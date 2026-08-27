import { createFileRoute } from "@tanstack/react-router";
import PaymentSuccess from "@/pages/PaymentSuccess";

export const Route = createFileRoute("/payment-success")({
  head: () => ({
    meta: [
      { title: "Payment Successful | Iftin Internet" },
      { name: "description", content: "Your data bundle payment was received and your package is being delivered." },
      { property: "og:title", content: "Payment Successful | Iftin Internet" },
      { property: "og:description", content: "Your data bundle payment was received and your package is being delivered." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <PaymentSuccess />;
}
