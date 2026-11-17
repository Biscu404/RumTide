// `npm run sandbox`: one Tide on its own page, with no login and no server and a seed you type. The live site
// mounts the same App with the shared Tide number (client/src/ui/Beta.tsx).
import { render } from "preact";
import { App, CSS } from "./tide.tsx";

const style = document.createElement("style");
style.textContent = CSS;
document.head.append(style);
render(<App />, document.getElementById("app")!);
