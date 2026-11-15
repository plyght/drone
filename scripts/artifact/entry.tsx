// The page as a standalone bundle, for publishing as a shareable artifact:
// the same World component, mounted without Next. Built by build.sh.
import { createRoot } from "react-dom/client";
import { World } from "@/components/world";

// The host sets data-theme only for an explicit choice. For "system" the
// stylesheet follows the OS; this tells the point field when that changes.
const light = matchMedia("(prefers-color-scheme: light)");
const mark = () => (document.documentElement.dataset.scheme = light.matches ? "light" : "dark");
mark();
light.addEventListener("change", mark);

createRoot(document.getElementById("root")!).render(<World />);
