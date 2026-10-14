import Phaser from "phaser";
import type { GameMap, MapNode } from "@engine/map.ts";
import {
  fitZoom, nodePoint, placeShips, sailColour, worldSize,
  type PlacedShip, type ShipMarker, type WorldSize,
} from "./layout.ts";

// Placeholder colours until the Endesga 32 recolour (week 3).
const SEA = 0x0b2a4a;
const LANE = 0x2f5d8a;
const ZONE_COLOUR = { crown: 0x6fa8dc, free: 0xd9c27a, maw: 0xc0504d } as const;
const MINE = 0xffd23f;
const FONT = "monospace";

const MAX_ZOOM = 4;
const WHEEL_STEP = 1.1;
/** You can zoom out a little past the fit, never so far that the map is lost. */
const MIN_ZOOM_OF_FIT = 0.8;

/**
 * The Brine: nodes, lanes and ships, with pan (drag) and zoom (wheel or pinch).
 * Phaser only draws here. Every menu and form is Preact.
 */
export class MapScene extends Phaser.Scene {
  private readonly map: GameMap;
  private readonly world: WorldSize;
  private ships: ShipMarker[] = [];
  private shipLayer?: Phaser.GameObjects.Container;
  private seaLabels: Phaser.GameObjects.Text[] = [];
  private fit = 1;
  private pinchDistance = 0;

  constructor(map: GameMap, ships: ShipMarker[] = []) {
    super("map");
    this.map = map;
    this.world = worldSize(map);
    this.ships = ships;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(SEA);

    this.drawLanes();
    this.drawNodes();
    this.shipLayer = this.add.container(0, 0).setDepth(10);
    this.drawShips();

    this.input.addPointer(1); // a second finger, for pinch zoom
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("wheel", this.onWheel, this);
    this.scale.on("resize", this.fitToView, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.fitToView, this);
    });

    this.fitToView();
  }

  /** Called from Preact when the ships change. Safe before the scene has started. */
  setShips(ships: ShipMarker[]): void {
    this.ships = ships;
    if (this.shipLayer) this.drawShips();
  }

  update(): void {
    const { pointer1, pointer2 } = this.input;
    if (!pointer1.isDown || !pointer2.isDown) {
      this.pinchDistance = 0;
      return;
    }
    const distance = Phaser.Math.Distance.Between(pointer1.x, pointer1.y, pointer2.x, pointer2.y);
    if (this.pinchDistance > 0) {
      const cam = this.cameras.main;
      this.zoomAround((pointer1.x + pointer2.x) / 2, (pointer1.y + pointer2.y) / 2, cam.zoom * (distance / this.pinchDistance));
    }
    this.pinchDistance = distance;
  }

  private fitToView(): void {
    const cam = this.cameras.main;
    this.fit = fitZoom(cam.width, cam.height, this.world);
    cam.setZoom(this.fit);
    cam.centerOn(this.world.width / 2, this.world.height / 2);
    this.updateSeaLabels();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    // Two fingers are a pinch, handled in update().
    if (!pointer.isDown || (this.input.pointer1.isDown && this.input.pointer2.isDown)) return;
    const cam = this.cameras.main;
    cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
    cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    const zoom = this.cameras.main.zoom * (dy < 0 ? WHEEL_STEP : 1 / WHEEL_STEP);
    this.zoomAround(pointer.x, pointer.y, zoom);
  }

  /** Zooms so the world point under (screenX, screenY) stays where it is. */
  private zoomAround(screenX: number, screenY: number, zoom: number): void {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(screenX, screenY);
    cam.setZoom(Phaser.Math.Clamp(zoom, this.fit * MIN_ZOOM_OF_FIT, MAX_ZOOM));
    const after = cam.getWorldPoint(screenX, screenY);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
    this.updateSeaLabels();
  }

  /** Open sea names only show once you have zoomed in, so the full map stays readable. */
  private updateSeaLabels(): void {
    const show = this.cameras.main.zoom >= this.fit * 1.6;
    for (const label of this.seaLabels) label.setVisible(show);
  }

  private drawLanes(): void {
    const lanes = this.add.graphics().setDepth(1);
    lanes.lineStyle(3, LANE, 1);
    for (const a of this.map.nodeIds) {
      for (const b of this.map.neighbours(a)) {
        if (b < a) continue; // each lane once
        const from = nodePoint(this.map, a);
        const to = nodePoint(this.map, b);
        lanes.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }

  private drawNodes(): void {
    const g = this.add.graphics().setDepth(2);
    for (const id of this.map.nodeIds) {
      const node = this.map.node(id);
      const { x, y } = nodePoint(this.map, id);
      const colour = ZONE_COLOUR[node.zone];
      this.drawNodeShape(g, node, x, y, colour);

      if (node.type === "sea") {
        const label = this.label(node.name, x, y + 14, 14, 0x9db8d4).setVisible(false);
        this.seaLabels.push(label);
      } else {
        this.label(node.name, x, y + (node.type === "port" ? 26 : 20), node.type === "port" ? 20 : 16, 0xffffff);
      }
    }
  }

  private drawNodeShape(g: Phaser.GameObjects.Graphics, node: MapNode, x: number, y: number, colour: number): void {
    g.fillStyle(colour, 1);
    switch (node.type) {
      case "port":
        g.fillRect(x - 11, y - 11, 22, 22);
        g.fillStyle(SEA, 1).fillRect(x - 5, y - 5, 10, 10);
        break;
      case "island":
        g.fillCircle(x, y, 10);
        break;
      case "wreck":
        g.fillTriangle(x - 9, y + 8, x + 9, y + 8, x, y - 9);
        break;
      case "fort":
        g.fillRect(x - 9, y - 9, 18, 18);
        g.fillStyle(SEA, 1).fillRect(x - 3, y - 3, 6, 6);
        break;
      default:
        g.fillCircle(x, y, 5);
    }
  }

  private drawShips(): void {
    const layer = this.shipLayer;
    if (!layer) return;
    layer.removeAll(true);
    for (const ship of placeShips(this.map, this.ships)) layer.add(this.shipObjects(ship));
  }

  private shipObjects(ship: PlacedShip): Phaser.GameObjects.GameObject[] {
    const sail = ship.isMine ? MINE : sailColour(ship.shipName);
    const g = this.add.graphics();
    g.fillStyle(0x3b2a1a, 1).fillRect(ship.x - 8, ship.y + 2, 16, 5); // hull
    g.fillStyle(sail, 1).fillTriangle(ship.x - 7, ship.y + 1, ship.x + 7, ship.y + 1, ship.x, ship.y - 12); // sail
    if (ship.isMine) g.lineStyle(2, MINE, 1).strokeCircle(ship.x, ship.y - 2, 15);
    const label = this.label(ship.shipName, ship.x, ship.y - 24, 14, ship.isMine ? MINE : 0xffffff);
    return [g, label];
  }

  private label(text: string, x: number, y: number, size: number, colour: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, resolution: 2, color: `#${colour.toString(16).padStart(6, "0")}` })
      .setOrigin(0.5)
      .setDepth(5);
  }
}
