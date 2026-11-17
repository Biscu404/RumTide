// `npm run sandbox`: the battle viewer on its own page, with no login and no server. The live site mounts the
// same App inside its own shell (client/src/ui/Beta.tsx).
import { render } from "preact";
import { App, CSS } from "./main.tsx";

const style = document.createElement("style");
style.textContent = CSS;
document.head.append(style);
render(<App />, document.getElementById("app")!);
