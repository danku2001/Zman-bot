import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZmanBot",
    short_name: "ZmanBot",
    description: "Hebrew Telegram reminder bot with a synchronized RTL dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#1f2a24",
    dir: "rtl",
    lang: "he"
  };
}
