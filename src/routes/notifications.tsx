import { createFileRoute } from "@tanstack/react-router";
import Notifications from "@/pages/Notifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | Iftin Internet" },
      { name: "description", content: "See delivery updates, offers and account alerts from Iftin Internet." },
      { property: "og:title", content: "Notifications | Iftin Internet" },
      { property: "og:description", content: "See delivery updates, offers and account alerts from Iftin Internet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Notifications />;
}
