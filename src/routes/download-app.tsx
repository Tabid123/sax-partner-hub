import { createFileRoute } from "@tanstack/react-router";
import DownloadApp from "@/pages/DownloadApp";

export const Route = createFileRoute("/download-app")({
  head: () => ({
    meta: [
      { title: "Download the Iftin Internet App" },
      { name: "description", content: "Install the Iftin Internet Android app for faster data purchases and offline ordering." },
      { property: "og:title", content: "Download the Iftin Internet App" },
      { property: "og:description", content: "Install the Iftin Internet Android app for faster data purchases and offline ordering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <DownloadApp />;
}
