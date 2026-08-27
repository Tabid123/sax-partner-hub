import { createFileRoute } from "@tanstack/react-router";
import ProviderSelection from "@/pages/ProviderSelection";

export const Route = createFileRoute("/offline-mode")({
  head: () => ({
    meta: [
      { title: "Offline Mode | Iftin Internet" },
      { name: "description", content: "Keep ordering bundles by SMS even when you have no internet connection." },
      { property: "og:title", content: "Offline Mode | Iftin Internet" },
      { property: "og:description", content: "Keep ordering bundles by SMS even when you have no internet connection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ProviderSelection />;
}
