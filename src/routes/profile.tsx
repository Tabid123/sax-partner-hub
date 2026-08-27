import { createFileRoute } from "@tanstack/react-router";
import Profile from "@/pages/Profile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile | Iftin Internet" },
      { name: "description", content: "Manage your phone number, language and account preferences." },
      { property: "og:title", content: "Your Profile | Iftin Internet" },
      { property: "og:description", content: "Manage your phone number, language and account preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Profile />;
}
