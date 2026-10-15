import { useEffect, useRef, useState } from "preact/hooks";
import Phaser from "phaser";
import { REPLAY_HEIGHT, REPLAY_WIDTH, ReplayScene } from "../scenes/ReplayScene.ts";
import type { Replay } from "./replayModel.ts";

interface Props { replay: Replay }

/** The biggest whole number of times the 320 by 180 picture fits, so it stays pixel perfect (section 2.1). */
function zoomFor(host: HTMLElement): number {
  const byWidth = host.clientWidth / REPLAY_WIDTH;
  const byHeight = (window.innerHeight * 0.4) / REPLAY_HEIGHT;
  return Math.max(1, Math.floor(Math.min(byWidth, byHeight)));
}

/**
 * Hosts the Phaser game for ReplayScene, with its buttons. Made when a battle is opened and thrown
 * away when it is closed. The text replay in the Gazette says the same things in words.
 */
export function ReplayView({ replay }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReplayScene | null>(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // People who ask their device for less motion get the end of the fight, and can play it if they want.
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const replayScene = new ReplayScene(replay, { autoplay: !calm, onFinished: () => setFinished(true) });
    scene.current = replayScene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      pixelArt: true,
      width: REPLAY_WIDTH,
      height: REPLAY_HEIGHT,
      scale: { mode: Phaser.Scale.NONE, zoom: zoomFor(el) },
      scene: replayScene,
    });
    const fit = () => game.scale.setZoom(zoomFor(el));
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => {
      watch.disconnect();
      scene.current = null;
      game.destroy(true);
    };
  }, [replay]);

  function togglePause() {
    const next = !paused;
    scene.current?.setPaused(next);
    setPaused(next);
  }

  function again() {
    scene.current?.setPaused(false);
    scene.current?.restart();
    setPaused(false);
    setFinished(false);
  }

  return (
    <div class="replay">
      <div class="replay-host" ref={host} role="img" aria-label={`Replay: ${replay.title}`} />
      <div class="actions">
        <button class="secondary" disabled={finished} onClick={togglePause}>{paused ? "Play" : "Pause"}</button>
        <button class="secondary" disabled={finished} onClick={() => scene.current?.skip()}>Skip to the end</button>
        <button class="secondary" onClick={again}>Watch again</button>
      </div>
    </div>
  );
}
