import { createFileRoute } from "@tanstack/react-router";
import ProviderSelection from "@/pages/ProviderSelection";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "Choose Your Network | Iftin Internet" },
      { name: "description", content: "Pick your mobile network and buy a data bundle with instant delivery." },
      { property: "og:title", content: "Choose Your Network | Iftin Internet" },
      { property: "og:description", content: "Pick your mobile network and buy a data bundle with instant delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ProviderSelection />;
}
