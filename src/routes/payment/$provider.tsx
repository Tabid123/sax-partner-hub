import { createFileRoute } from "@tanstack/react-router";
import PaymentProviders from "@/pages/PaymentProviders";

export const Route = createFileRoute("/payment/$provider")({
  head: () => ({
    meta: [
      { title: "Complete Your Payment | Iftin Internet" },
      { name: "description", content: "Confirm your bundle and pay securely with your preferred mobile money provider." },
      { property: "og:title", content: "Complete Your Payment | Iftin Internet" },
      { property: "og:description", content: "Confirm your bundle and pay securely with your preferred mobile money provider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <PaymentProviders />;
}
