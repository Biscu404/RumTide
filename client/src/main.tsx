import { render } from "preact";
import { App } from "./ui/App.tsx";
import "./ui/style.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element in index.html");
render(<App />, root);
