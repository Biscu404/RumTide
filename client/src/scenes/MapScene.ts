import Phaser from "phaser";
import type { GameMap, MapNode } from "@engine/map.ts";
import {
  fitZoom, hexColour, markerBoost, nodePoint, placeShips, sailColour, worldSize,
  type PlacedShip, type ShipMarker, type WorldSize,
} from "./layout.ts";
import { C, rgb } from "../palette.ts";

const SEA = rgb(C.deepSea);
const LANE = rgb(C.shallows);
// The zone is also in the node's name and the Orders screen, so the colour is never the only signal.
const ZONE_COLOUR = { crown: rgb(C.highlight), free: rgb(C.sand), maw: rgb(C.danger) } as const;
const MINE = rgb(C.goldLight);
const HULL = rgb(C.woodDark);
const FONT = "monospace";

const MAX_ZOOM = 4;
const WHEEL_STEP = 1.1;
/** You can zoom out a little past the fit, never so far that the map is lost. */
const MIN_ZOOM_OF_FIT = 0.8;

interface NodeLabel { label: Phaser.GameObjects.Text; x: number; y: number; below: number }

/**
 * The Brine: nodes, lanes and ships, with pan (drag) and zoom (wheel or pinch).
 * Phaser only draws here. Every menu and form is Preact.
 */
export class MapScene extends Phaser.Scene {
  private readonly map: GameMap;
  private readonly world: WorldSize;
  private ships: ShipMarker[] = [];
  private shipLayer?: Phaser.GameObjects.Container;
  private laneLayer?: Phaser.GameObjects.Graphics;
  private nodeLayer?: Phaser.GameObjects.Graphics;
  private nodeLabels: NodeLabel[] = [];
  private seaLabels: Phaser.GameObjects.Text[] = [];
  /** Marks are drawn this many times larger when the map is zoomed far out (section 2.2, phone first). */
  private boost = 1;
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
    this.updateBoost();
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
    this.updateBoost();
    this.updateSeaLabels();
  }

  /** Redraws nodes, names and ships at their new size when the zoom has changed enough to matter. */
  private updateBoost(): void {
    const next = markerBoost(this.cameras.main.zoom);
    if (Math.abs(next - this.boost) < 0.05) return;
    this.boost = next;
    this.drawLanes();
    this.layoutNodes();
    this.drawShips();
  }

  /** Open sea names only show once you have zoomed in, so the full map stays readable. */
  private updateSeaLabels(): void {
    const show = this.cameras.main.zoom >= this.fit * 1.6;
    for (const label of this.seaLabels) label.setVisible(show);
  }

  private drawLanes(): void {
    const lanes = (this.laneLayer ??= this.add.graphics().setDepth(1));
    lanes.clear();
    lanes.lineStyle(3 * this.boost, LANE, 1);
    for (const a of this.map.nodeIds) {
      for (const b of this.map.neighbours(a)) {
        if (b < a) continue; // each lane once
        const from = nodePoint(this.map, a);
        const to = nodePoint(this.map, b);
        lanes.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }

  /** Makes the name labels once. `layoutNodes` draws the shapes and places the labels at the current size. */
  private drawNodes(): void {
    this.nodeLayer = this.add.graphics().setDepth(2);
    for (const id of this.map.nodeIds) {
      const node = this.map.node(id);
      const { x, y } = nodePoint(this.map, id);
      if (node.type === "sea") {
        const label = this.label(node.name, x, y, 14, rgb(C.mist)).setVisible(false);
        this.seaLabels.push(label);
        this.nodeLabels.push({ label, x, y, below: 14 });
      } else {
        const label = this.label(node.name, x, y, node.type === "port" ? 20 : 16, rgb(C.foam));
        this.nodeLabels.push({ label, x, y, below: node.type === "port" ? 26 : 20 });
      }
    }
    this.layoutNodes();
  }

  private layoutNodes(): void {
    const g = this.nodeLayer;
    if (!g) return;
    g.clear();
    for (const id of this.map.nodeIds) {
      const { x, y } = nodePoint(this.map, id);
      this.drawNodeShape(g, this.map.node(id), x, y, ZONE_COLOUR[this.map.node(id).zone]);
    }
    for (const { label, x, y, below } of this.nodeLabels) label.setPosition(x, y + below * this.boost).setScale(this.boost);
  }

  private drawNodeShape(g: Phaser.GameObjects.Graphics, node: MapNode, x: number, y: number, colour: number): void {
    const k = this.boost;
    g.fillStyle(colour, 1);
    switch (node.type) {
      case "port":
        g.fillRect(x - 11 * k, y - 11 * k, 22 * k, 22 * k);
        g.fillStyle(SEA, 1).fillRect(x - 5 * k, y - 5 * k, 10 * k, 10 * k);
        break;
      case "island":
        g.fillCircle(x, y, 10 * k);
        break;
      case "wreck":
        g.fillTriangle(x - 9 * k, y + 8 * k, x + 9 * k, y + 8 * k, x, y - 9 * k);
        break;
      case "fort":
        g.fillRect(x - 9 * k, y - 9 * k, 18 * k, 18 * k);
        g.fillStyle(SEA, 1).fillRect(x - 3 * k, y - 3 * k, 6 * k, 6 * k);
        break;
      default:
        g.fillCircle(x, y, 5 * k);
    }
  }

  private drawShips(): void {
    const layer = this.shipLayer;
    if (!layer) return;
    layer.removeAll(true);
    for (const ship of placeShips(this.map, this.ships)) layer.add(this.shipObjects(ship));
  }

  private shipObjects(ship: PlacedShip): Phaser.GameObjects.GameObject[] {
    // A fleet's ships all fly its colour; your own ship is told apart by the ring.
    const sail = ship.fleetColour !== undefined ? hexColour(ship.fleetColour) : ship.isMine ? MINE : sailColour(ship.shipName);
    // Drawn around its own origin, so it can grow about the spot it sails from.
    const g = this.add.graphics().setPosition(ship.x, ship.y).setScale(this.boost);
    g.fillStyle(HULL, 1).fillRect(-8, 2, 16, 5); // hull
    g.fillStyle(sail, 1).fillTriangle(-7, 1, 7, 1, 0, -12); // sail
    if (ship.isMine) g.lineStyle(2, MINE, 1).strokeCircle(0, -2, 15);
    const label = this.label(ship.shipName, ship.x, ship.y - 24 * this.boost, 14, ship.isMine ? MINE : rgb(C.foam)).setScale(this.boost);
    return [g, label];
  }

  private label(text: string, x: number, y: number, size: number, colour: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, resolution: 2, color: `#${colour.toString(16).padStart(6, "0")}` })
      .setOrigin(0.5)
      .setDepth(5);
  }
}
