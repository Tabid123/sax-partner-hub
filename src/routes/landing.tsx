import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/pages/Landing";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Iftin Internet — Reseller Platform for Somali Data" },
      { name: "description", content: "Grow your data reselling business with automated delivery, wholesale pricing and real-time reporting." },
      { property: "og:title", content: "Iftin Internet — Reseller Platform for Somali Data" },
      { property: "og:description", content: "Grow your data reselling business with automated delivery, wholesale pricing and real-time reporting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Landing />;
}
