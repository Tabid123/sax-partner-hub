import { createFileRoute } from "@tanstack/react-router";
import PrivacyPolicy from "@/pages/PrivacyPolicy";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Iftin Internet" },
      { name: "description", content: "How Iftin Internet collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy | Iftin Internet" },
      { property: "og:description", content: "How Iftin Internet collects, uses and protects your personal information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <PrivacyPolicy />;
}
