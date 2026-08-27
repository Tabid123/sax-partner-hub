import { createFileRoute } from "@tanstack/react-router";
import DataPackages from "@/pages/DataPackages";

export const Route = createFileRoute("/packages/$provider")({
  head: () => ({
    meta: [
      { title: "Data & Voice Packages | Iftin Internet" },
      { name: "description", content: "Browse available data and voice packages and buy in seconds." },
      { property: "og:title", content: "Data & Voice Packages | Iftin Internet" },
      { property: "og:description", content: "Browse available data and voice packages and buy in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <DataPackages />;
}
