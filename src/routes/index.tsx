import { createFileRoute } from "@tanstack/react-router";
import RootRoute from "@/components/RootRoute";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Iftin Internet — Buy Mobile Data in Somalia" },
      { name: "description", content: "Buy mobile data bundles from Hormuud, Somtel, Somlink, Somnet and Amtel in seconds with instant delivery." },
      { property: "og:title", content: "Iftin Internet — Buy Mobile Data in Somalia" },
      { property: "og:description", content: "Buy mobile data bundles from Hormuud, Somtel, Somlink, Somnet and Amtel in seconds with instant delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RootRoute />;
}
