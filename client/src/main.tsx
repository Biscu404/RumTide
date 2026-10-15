import { render } from "preact";
import { sound } from "./audio/sound.ts";
import { App } from "./ui/App.tsx";
import "./ui/style.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element in index.html");
sound.listenForFirstTap(window);
render(<App />, root);
