import { useState } from "preact/hooks";
import { sound } from "../audio/sound.ts";

/** The sound on and off button. Pressing it is a tap, so it also unlocks sound in the browser. */
export function SoundToggle() {
  const [muted, setMuted] = useState(sound.muted);

  function toggle() {
    sound.unlock();
    sound.setMuted(!muted);
    setMuted(!muted);
    sound.play("coin"); // a short confirmation when it comes on; silent when it goes off
  }

  return (
    <button class="secondary" aria-pressed={!muted} onClick={toggle}>
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}
