// Site-wide facts in one place.

export const SITE = {
  name: "Mercury",
  tagline: "Drones that do real physical work for people.",
  description:
    "Mercury designs drones that do real physical work for people: checking in on someone, helping in a rescue, inspecting what's hard to reach. A family of single-job designs, and the engineering platform that designs them.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://mercury.example",
  // PLACEHOLDER. Swap for the address Mercury wants public before launch.
  email: "hello@mercury.example",
  // The line that keeps the page honest. It goes under anything that
  // describes behaviour.
  footnote: "This describes the design. It has not been flown yet.",
};
