import { createFileRoute } from "@tanstack/react-router";
import CategorySelection from "@/pages/CategorySelection";

export const Route = createFileRoute("/categories/$provider")({
  head: () => ({
    meta: [
      { title: "Choose a Bundle Type | Iftin Internet" },
      { name: "description", content: "Pick the bundle category you need — data, voice, or combo — for your network." },
      { property: "og:title", content: "Choose a Bundle Type | Iftin Internet" },
      { property: "og:description", content: "Pick the bundle category you need — data, voice, or combo — for your network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <CategorySelection />;
}
