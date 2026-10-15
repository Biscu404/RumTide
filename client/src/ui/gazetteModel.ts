import type { GameMap } from "@engine/map.ts";
import type { Battle, NpcKind, RoundRecord, RoundShipRecord } from "@engine/types.ts";
import { maneuverLabel } from "./ordersModel.ts";

// The text replay of a battle (section 16.1, Gazette screen): every round listed one by one, built
// only from the Battle record the engine saved, so what the screen says is what happened.

export interface Names {
  captains: Record<string, string>;
  npcs: Record<string, NpcKind>;
}

const NPC_NAME: Record<NpcKind, string> = {
  smallTrader: "a Small Trader", fatMerchant: "a Fat Merchant", galleon: "the Treasure Galleon",
};

export function shipLabel(id: string, names: Names): string {
  const kind = names.npcs[id];
  if (kind) return NPC_NAME[kind];
  return names.captains[id] ?? "an unknown ship";
}

export function listOf(labels: readonly string[]): string {
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

const sideLabel = (ids: readonly string[], names: Names) => listOf(ids.map((id) => shipLabel(id, names)));

export interface RoundText {
  round: number;
  /** What each ship did, side 0 first. */
  ships: string[];
  /** The damage each side dealt and the hulls left. */
  summary: string;
}

export interface BattleText {
  id: string;
  title: string;
  place: string;
  rounds: RoundText[];
  result: string;
  /** Gold changing hands, and bounties put on heads. Empty for a fight with a merchant or a draw. */
  aftermath: string[];
}

function shipLine(record: RoundShipRecord, names: Names): string {
  const edge = record.matchup > 1 ? "had the edge" : record.matchup < 1 ? "was at a disadvantage" : "met an even match";
  const stale = record.stale ? ", repeating the last round's move" : "";
  return `${shipLabel(record.shipId, names)} chose ${maneuverLabel(record.maneuver)}, ${edge}${stale}, and dealt ${Math.round(record.damage)}.`;
}

function roundText(round: RoundRecord, sideNames: string[], names: Names): RoundText {
  const hulls = Object.keys(round.hullAfter).sort()
    .map((id) => `${shipLabel(id, names)} ${Math.round(round.hullAfter[id]!)}`);
  return {
    round: round.round,
    ships: round.ships.map((r) => shipLine(r, names)),
    summary: `${sideNames[0]} dealt ${Math.round(round.sideDamage[0])}, ${sideNames[1]} dealt ${Math.round(round.sideDamage[1])}. Hull left: ${hulls.join(", ")}.`,
  };
}

export function describeBattle(battle: Battle, names: Names, map: GameMap): BattleText {
  const sideIds = battle.sides.map((s) => [...s.captainIds, ...s.npcIds]);
  const sideNames = sideIds.map((ids) => sideLabel(ids, names));
  const place = map.node(battle.nodeId).name;

  let result: string;
  if (battle.winner === null) {
    result = `A draw. Neither side won by a clear margin.`;
  } else {
    const winner = sideNames[battle.winner]!, loser = sideNames[battle.winner === 0 ? 1 : 0]!;
    result = battle.outcome === "decisive"
      ? `${winner} won decisively and forced ${loser} to strike her colours.`
      : `${winner} won by a clear margin over ${loser}.`;
  }

  const aftermath = [
    ...battle.loot.map((l) => `${shipLabel(l.toId, names)} took ${Math.round(l.gold)} doubloons from ${shipLabel(l.fromId, names)}.`),
    ...battle.bountiesAdded.map((b) => `A bounty of ${Math.round(b.amount)} doubloons was put on ${shipLabel(b.captainId, names)}.`),
  ];

  return {
    id: battle.id,
    title: `${sideNames[0]} against ${sideNames[1]}`,
    place,
    rounds: battle.rounds.map((r) => roundText(r, sideNames, names)),
    result,
    aftermath,
  };
}
