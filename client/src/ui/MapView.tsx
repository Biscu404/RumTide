import { useEffect, useRef } from "preact/hooks";
import Phaser from "phaser";
import type { GameMap } from "@engine/map.ts";
import { MapScene } from "../scenes/MapScene.ts";
import type { ShipMarker } from "../scenes/layout.ts";

interface Props { map: GameMap; ships: ShipMarker[] }

/** Hosts the Phaser game for MapScene. The canvas fills its parent and follows its size. */
export function MapView({ map, ships }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MapScene | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const mapScene = new MapScene(map, ships);
    scene.current = mapScene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      scene: mapScene,
    });
    return () => {
      scene.current = null;
      game.destroy(true);
    };
    // The game is made once per map. Ships are pushed in by the next effect.
  }, [map]);

  useEffect(() => {
    scene.current?.setShips(ships);
  }, [ships]);

  return <div class="map-host" ref={host} />;
}
