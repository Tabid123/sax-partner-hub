import { createFileRoute } from "@tanstack/react-router";
import ResellerLogin from "@/pages/ResellerLogin";

export const Route = createFileRoute("/reseller/login")({
  head: () => ({
    meta: [
      { title: "Reseller Login | Iftin Internet" },
      { name: "description", content: "Sign in to your Iftin Internet reseller dashboard." },
      { property: "og:title", content: "Reseller Login | Iftin Internet" },
      { property: "og:description", content: "Sign in to your Iftin Internet reseller dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ResellerLogin />;
}
