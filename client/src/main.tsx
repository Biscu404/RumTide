import { render } from "preact";
import { SEASON_PRESETS } from "@engine/balance.ts";

// Placeholder page. The season length is read through the @engine alias to prove it resolves.
function App() {
  return (
    <main>
      <h1>Rumtide</h1>
      <p>Season 0 beta: {SEASON_PRESETS.season0.lengthTides} Tides</p>
    </main>
  );
}

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element in index.html");
render(<App />, root);
