// The sandbox battle viewer page (docs/briefs/sandbox.md, stage 1). Preact and plain SVG, no server, no login.
// The battle comes from setup.ts (the real engine_v3) and every sentence from words.ts.

import { useEffect, useRef, useState } from "preact/hooks";
import { RANGES } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { BattleSide, FightingStyle, Range } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { C } from "../../client/src/palette.ts";
import { RIGHT_PICKS, STYLE_PICKS, doctrineFor, pickName, runFight } from "./setup.ts";
import type { Fight, Pick } from "./setup.ts";
import { DEFAULT_SPEED, FLOAT_MS, GHOST_HOLD_MS, GHOST_SLIDE_MS, GLIDE_MS, HIT_MS, PAUSE_MS, SHOT_MS, SPEEDS, SPEED_NAME, hitDelayMs, roundAnimMs } from "./pacing.ts";
import type { Speed } from "./pacing.ts";
import { roundMotion, roundSummary } from "./summary.ts";
import type { Motion } from "./summary.ts";
import { RANGE_NAME, doctrineWords, endingWords, rangeAt, roundLog, shipsBySide, stateAt } from "./words.ts";

const SIDES: readonly BattleSide[] = ["hunter", "target"];
const SIDE_COLOUR: Record<BattleSide, string> = { hunter: C.gold, target: C.rose };
const MAX_SEED = 999999;
const FIRST_ROUND_WAIT_MS = 600; // Play waits this long before the first round

export const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.ink}; color: ${C.parchment}; font: 16px/1.45 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: ${C.gold}; }
  h2 { font-size: 17px; margin: 0 0 8px; color: ${C.goldLight}; }
  h3 { font-size: 15px; margin: 0 0 4px; }
  p { margin: 0 0 8px; }
  .dim { color: ${C.mist}; font-size: 14px; }
  .panel { background: ${C.nightSea}; border: 2px solid ${C.slate}; border-radius: 6px; padding: 12px; margin: 12px 0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  label { display: block; font-size: 14px; margin-bottom: 4px; }
  select, input { width: 100%; padding: 10px 8px; font: inherit; color: ${C.ink}; background: ${C.parchment}; border: 2px solid ${C.wood}; border-radius: 4px; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  button { padding: 10px 14px; font: inherit; font-weight: 600; color: ${C.ink}; background: ${C.gold}; border: 2px solid ${C.goldLight}; border-radius: 4px; cursor: pointer; }
  button.plain { background: ${C.mist}; border-color: ${C.foam}; }
  button:disabled { opacity: 0.45; cursor: default; }
  svg { display: block; width: 100%; height: auto; border-radius: 4px; }
  .track { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin: 8px 0 12px; }
  .track span { text-align: center; font-size: 12px; padding: 4px 0; border-radius: 4px; background: ${C.slate}; color: ${C.mist}; }
  .track span.on { background: ${C.goldLight}; color: ${C.ink}; font-weight: 700; }
  .barrow { display: flex; justify-content: space-between; font-size: 13px; }
  .barline { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .bar { position: relative; flex: 1; height: 12px; background: ${C.ink}; border-radius: 3px; overflow: hidden; }
  .bar .fill, .bar .ghost { position: absolute; left: 0; top: 0; height: 100%; }
  .bar .fill { z-index: 1; }
  .bar .ghost { background: ${C.goldLight}; }
  .slot { position: relative; width: 40px; height: 16px; }
  .float { position: absolute; left: 0; top: 0; font-size: 14px; font-weight: 700; line-height: 16px; color: ${C.rose}; white-space: nowrap; opacity: 0; }
  .track span.was { outline: 2px dashed ${C.goldLight}; outline-offset: -2px; color: ${C.parchment}; }
  .move { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: ${C.goldLight}; min-height: 20px; }
  .story { background: ${C.ink}; border-left: 4px solid ${C.goldLight}; border-radius: 4px; padding: 10px 12px; margin: 12px 0; }
  .story h3 { color: ${C.goldLight}; }
  .story p { font-size: 15px; margin-bottom: 6px; }
  .story .choice { padding-left: 8px; border-left: 3px solid ${C.slate}; }
  .story .meeting { margin-top: 8px; padding-top: 8px; border-top: 1px solid ${C.slate}; }
  .speed { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font-size: 14px; }
  .speed button { padding: 6px 10px; font-size: 14px; background: ${C.slate}; color: ${C.parchment}; border-color: ${C.dusk}; }
  .speed button.on { background: ${C.goldLight}; color: ${C.ink}; border-color: ${C.gold}; }
  .round.current { background: ${C.slate}; border-radius: 6px; padding: 10px; border-left: 4px solid ${C.goldLight}; }
  .round.current h3::after { content: " (showing now)"; color: ${C.goldLight}; font-weight: 400; font-size: 13px; }

  /* The picture. Ships glide with a CSS transition; everything in .fx plays once per round and is hidden for reduced motion. */
  .boat { transition: transform ${GLIDE_MS}ms ease-in-out, opacity ${GLIDE_MS}ms; }
  .fx * { transform-box: fill-box; transform-origin: center; }
  .wake { fill: none; stroke: ${C.foam}; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; animation: wake ${GLIDE_MS + 500}ms ease-out both; }
  .arrow, .tag { opacity: 0; animation: fadeio ${GLIDE_MS + 600}ms ease-in-out both; }
  .flash { fill: ${C.goldLight}; opacity: 0; animation: flash 250ms ease-out both; }
  .ball { fill: ${C.orange}; stroke: ${C.ink}; stroke-width: 0.6; opacity: 0; animation: ball ${SHOT_MS - 100}ms linear both; }
  .ball.arc { animation-name: arc; }
  .hit { fill: ${C.goldLight}; stroke: ${C.orange}; stroke-width: 1; opacity: 0; animation: hit ${HIT_MS}ms ease-out both; }
  .splash { fill: none; stroke: ${C.foam}; stroke-width: 1.2; opacity: 0; animation: splash ${HIT_MS + 100}ms ease-out both; }
  .cut { stroke: ${C.parchment}; stroke-width: 1.5; opacity: 0; animation: cut ${GLIDE_MS + 200}ms ease-out both; }
  .rope { fill: none; stroke: ${C.parchment}; stroke-width: 1.6; }
  .rope.draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 300ms ease-out both; }
  .bar .fill.drop { animation: snap 1ms linear both; }
  .bar .ghost { animation: ghost ${GHOST_SLIDE_MS}ms ease-in both; }
  .float.go { animation: floatup ${FLOAT_MS}ms ease-out both; }
  @keyframes wake { 0% { stroke-dashoffset: 1; opacity: 0.9; } 55% { stroke-dashoffset: 0; opacity: 0.9; } 100% { stroke-dashoffset: 0; opacity: 0; } }
  @keyframes fadeio { 0% { opacity: 0; } 25% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes flash { 0% { opacity: 0; transform: scale(0.3); } 25% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.6); } }
  @keyframes ball { 0% { opacity: 0; transform: translateX(0); } 1% { opacity: 1; transform: translateX(0); } 99% { opacity: 1; } 100% { opacity: 0; transform: translateX(var(--dx)); } }
  @keyframes arc { 0% { opacity: 0; transform: translate(0, 0); } 1% { opacity: 1; transform: translate(0, 0); } 50% { opacity: 1; transform: translate(calc(var(--dx) * 0.5), -24px); } 99% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), 0); } }
  @keyframes hit { 0% { opacity: 0; transform: scale(0.2); } 30% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.4); } }
  @keyframes splash { 0% { opacity: 0; transform: scale(0.3); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(2); } }
  @keyframes cut { 0% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes snap { from { width: var(--from); } to { width: var(--to); } }
  @keyframes ghost { from { width: var(--from); } to { width: var(--to); } }
  @keyframes floatup { 0% { opacity: 0; transform: translateY(6px); } 15% { opacity: 1; transform: translateY(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
  /* Reduced motion: no sliding, no ghost, no flying numbers. The words stay. */
  .calm .boat { transition: none; }
  .calm .fx, .calm .float { display: none; }
  .calm .ghost { display: none; }
  .calm .fill.drop, .calm .rope.draw { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
  .check { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
  .check input { width: auto; padding: 0; }
  .end { border-color: ${C.gold}; }
  .how { display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${C.gold}; color: ${C.ink}; font-weight: 700; margin-bottom: 6px; }
  ol, ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 4px; font-size: 14px; }
  .round { border-top: 2px solid ${C.slate}; padding-top: 10px; margin-top: 10px; }
  .round:first-of-type { border-top: 0; margin-top: 0; padding-top: 0; }
  @media (max-width: 520px) { .log.two { grid-template-columns: 1fr; } main { padding: 10px; } }
`;

// ---------- The picture ----------

/** How far each ship sits from the middle of the picture at each distance. */
const HALF_GAP: Record<Range, number> = { far: 126, long: 102, medium: 78, short: 54, close: 32, grappled: 17 };
const MID = 160;
const SEA_Y = 78;

function Boat(props: { x: number; colour: string; faces: 1 | -1; monster: boolean; sunk: boolean; burning: boolean }) {
  // One fixed list of transform functions, so the browser can glide between any two positions (see .boat in the CSS).
  const rotate = props.sunk ? props.faces * 28 : 0;
  const drop = props.sunk ? 12 : 0;
  return (
    <g class="boat" style={`transform: translate(${props.x}px, ${SEA_Y}px) rotate(${rotate}deg) translate(0px, ${drop}px) scale(${props.faces}, 1)`} opacity={props.sunk ? 0.45 : 1}>
      {props.monster ? (
        <>
          <ellipse cx="0" cy="-4" rx="15" ry="12" fill={C.jungleDark} stroke={C.jungleDeep} stroke-width="2" />
          <path d="M 12 -4 L 22 -12 L 20 -4 L 24 0 L 13 2 Z" fill={props.colour} />
          <circle cx="8" cy="-9" r="1.6" fill={C.ink} />
        </>
      ) : (
        <>
          <path d="M -14 -6 L 16 -6 L 10 4 L -10 4 Z" fill={C.wood} stroke={C.woodDeep} stroke-width="1.5" />
          <rect x="-1" y="-30" width="2" height="24" fill={C.woodDeep} />
          <path d="M 2 -29 L 14 -10 L 2 -10 Z" fill={props.colour} />
        </>
      )}
      {props.burning ? <path d="M -6 -8 L -2 -20 L 1 -12 L 4 -18 L 6 -8 Z" fill={C.orange} /> : null}
    </g>
  );
}

/** Where a ship sits for one distance. The left ship is the hunter. */
const shipX = (side: BattleSide, gap: number): number => (side === "hunter" ? MID - gap : MID + gap);
const faceOf = (side: BattleSide): 1 | -1 => (side === "hunter" ? 1 : -1);
const MUZZLE_Y = SEA_Y - 6;
const ROPE_HEIGHTS = [-22, -14, -7];

/** Everything that plays once in a round: wakes, arrows, shots, splashes and cut ropes. It is remounted every round, so it replays. */
function Effects(props: { motion: Motion; gapBefore: number; gapNow: number }) {
  const { motion, gapBefore, gapNow } = props;
  const moved = motion.rangeBefore !== motion.rangeAfter || motion.escaped;
  const t0 = moved ? GLIDE_MS : 0; // shots wait for the ships to arrive
  const label = motion.escaped || motion.direction === "opening" ? "pulling apart" : motion.direction === "closing" ? "closing in" : "";
  return (
    <g class="fx">
      {moved ? SIDES.map((side) => {
        const x1 = shipX(side, gapBefore);
        const x2 = shipX(side, gapNow);
        const dir = x2 >= x1 ? 1 : -1;
        return (
          <g>
            <line class="wake" pathLength="1" x1={x1} y1={SEA_Y + 4} x2={x2} y2={SEA_Y + 4} stroke-width="2.4" />
            <line class="wake" pathLength="1" x1={x1 - dir * 3} y1={SEA_Y + 8} x2={x2 - dir * 3} y2={SEA_Y + 8} stroke-width="1.4" />
            <polygon class="arrow" points="-6,-5 6,0 -6,5" fill={SIDE_COLOUR[side]} transform={`translate(${x2} ${SEA_Y - 38}) scale(${dir} 1)`} />
          </g>
        );
      }) : null}
      {moved && label ? <text class="tag" x={MID} y="14" text-anchor="middle" font-size="10" font-weight="700" fill={C.goldLight}>{label}</text> : null}
      {motion.cutApart ? SIDES.map((side) => ROPE_HEIGHTS.map((dy) => (
        <line class="cut" x1={shipX(side, gapBefore)} y1={SEA_Y + dy} x2={shipX(side, gapBefore) + faceOf(side) * 9} y2={SEA_Y + dy + 3} />
      ))) : null}
      {motion.shots.map((shot) => {
        const face = faceOf(shot.from);
        const fromX = shipX(shot.from, gapNow) + face * 16;
        const toX = shipX(shot.to, gapNow) - face * 12;
        const dx = toX - fromX;
        return (
          <g>
            <circle class="flash" cx={fromX} cy={MUZZLE_Y} r="5" style={`animation-delay:${t0}ms`} />
            <circle class={shot.kind === "mortar" ? "ball arc" : "ball"} cx={fromX} cy={MUZZLE_Y} r="2.4" style={`--dx:${dx}px;animation-delay:${t0 + 100}ms`} />
            {shot.hit ? (
              <g transform={`translate(${toX} ${MUZZLE_Y})`}>
                <polygon class="hit" points="0,-8 2.4,-2.4 8,0 2.4,2.4 0,8 -2.4,2.4 -8,0 -2.4,-2.4" style={`animation-delay:${t0 + SHOT_MS}ms`} />
              </g>
            ) : (
              <ellipse class="splash" cx={toX} cy={SEA_Y + 4} rx="5" ry="2" style={`animation-delay:${t0 + SHOT_MS}ms`} />
            )}
          </g>
        );
      })}
    </g>
  );
}

function Picture(props: { fight: Fight; shown: number; calm: boolean }) {
  const { record } = props.fight;
  const range = rangeAt(record, props.shown);
  const round = record.rounds[props.shown - 1];
  const motion = round ? roundMotion(record, props.shown - 1) : null;
  const escaped = motion?.escaped ?? false;
  const gap = escaped ? MID - 8 : HALF_GAP[range];
  const gapBefore = motion ? HALF_GAP[motion.rangeBefore] : gap;
  const start = shipsBySide(record.ships);
  const state = stateAt(record, props.shown);
  const burning = (side: BattleSide): boolean => round?.ships.find((s) => s.ship === start[side].shipId)?.fire !== undefined;
  const sunk = (side: BattleSide): boolean => state[side].hull <= 0;
  const roundKey = `${props.fight.seed}-${props.shown}`;
  const t0 = motion && (motion.rangeBefore !== motion.rangeAfter || motion.escaped) ? GLIDE_MS : 0;
  return (
    <svg viewBox="0 0 320 110" role="img" aria-label={`The two ships at ${RANGE_NAME[range]} distance`}>
      <rect x="0" y="0" width="320" height="110" fill={C.deepSea} />
      <rect x="0" y={SEA_Y} width="320" height={110 - SEA_Y} fill={C.nightSea} />
      {RANGES.map((r) => [-1, 1].map((dir) => (
        <rect x={MID + dir * HALF_GAP[r] - 1} y={SEA_Y + 8} width="2" height={r === range ? 10 : 5} fill={r === range ? C.goldLight : C.dusk} />
      )))}
      {range === "grappled" && !escaped ? ROPE_HEIGHTS.map((dy, i) => (
        <path
          key={`${roundKey}-${i}`} class={motion?.hooksThrown ? "rope draw" : "rope"} pathLength="1"
          d={`M ${MID - gap} ${SEA_Y + dy} Q ${MID} ${SEA_Y + dy + 5} ${MID + gap} ${SEA_Y + dy}`}
          style={motion?.hooksThrown ? `animation-delay:${t0 + i * 80}ms` : undefined}
        />
      )) : null}
      <Boat x={MID - gap} colour={SIDE_COLOUR.hunter} faces={1} monster={false} sunk={sunk("hunter")} burning={burning("hunter")} />
      <Boat x={MID + gap} colour={SIDE_COLOUR.target} faces={-1} monster={props.fight.picks.target === "shellback"} sunk={sunk("target")} burning={burning("target")} />
      {motion && !props.calm ? <Effects key={roundKey} motion={motion} gapBefore={gapBefore} gapNow={gap} /> : null}
    </svg>
  );
}

/** A number that changes `delayMs` after the value does when it drops, so it moves with the bar and not before it. */
function useLater(value: number, delayMs: number): number {
  const [shownValue, setShownValue] = useState(value);
  useEffect(() => {
    if (delayMs <= 0 || value >= shownValue) { setShownValue(value); return; }
    const timer = setTimeout(() => setShownValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return shownValue;
}

interface BarSpec { name: string; now: number; before: number; max: number; colour: string }

/** One bar. The main part drops to the new value when the hit lands, a yellow ghost stays where the lost part was and then slides away. */
function BarRow(props: { spec: BarSpec; roundKey: string; delayMs: number; calm: boolean }) {
  const { spec, roundKey, delayMs, calm } = props;
  const pctOf = (v: number): number => (spec.max > 0 ? Math.max(0, Math.min(100, (v / spec.max) * 100)) : 0);
  const lost = Math.max(0, Math.round(spec.before) - Math.round(spec.now));
  const animate = lost > 0 && !calm;
  const text = useLater(Math.round(spec.now), delayMs);
  const vars = `--from:${pctOf(spec.before)}%;--to:${pctOf(spec.now)}%`;
  return (
    <div>
      <div class="barrow"><span>{spec.name}</span><span>{spec.max > 0 ? `${text} of ${spec.max}` : "none"}</span></div>
      <div class="barline">
        <div class="bar">
          {animate ? <div key={`g-${roundKey}`} class="ghost" style={`${vars};width:${pctOf(spec.now)}%;animation-delay:${delayMs + GHOST_HOLD_MS}ms`} /> : null}
          <div key={`f-${roundKey}`} class={animate ? "fill drop" : "fill"} style={`${vars};width:${pctOf(spec.now)}%;background:${spec.colour};${animate ? `animation-delay:${delayMs}ms` : ""}`} />
        </div>
        <div class="slot">{animate ? <span key={`n-${roundKey}`} class="float go" style={`animation-delay:${delayMs}ms`}>-{lost}</span> : null}</div>
      </div>
    </div>
  );
}

function Bars(props: { fight: Fight; shown: number; side: BattleSide; motion: Motion | null; calm: boolean }) {
  const ship = shipsBySide(props.fight.record.ships)[props.side];
  const now = stateAt(props.fight.record, props.shown)[props.side];
  const before = stateAt(props.fight.record, Math.max(0, props.shown - 1))[props.side];
  const rows: BarSpec[] = [
    { name: "Hull", now: now.hull, before: before.hull, max: ship.maxHullPoints, colour: C.clay },
    { name: "Rigging", now: now.rigging, before: before.rigging, max: ship.maxRiggingPoints, colour: C.mist },
    { name: "Hands", now: now.hands, before: before.hands, max: ship.maxHands, colour: C.jungle },
  ];
  const delayMs = props.motion && !props.calm ? hitDelayMs(props.motion) : 0;
  return (
    <div>
      <h3 style={{ color: SIDE_COLOUR[props.side] }}>{ship.name}</h3>
      {rows.map((spec) => <BarRow spec={spec} roundKey={`${props.fight.seed}-${props.shown}-${spec.name}`} delayMs={delayMs} calm={props.calm} />)}
    </div>
  );
}

/** What each ship chose and why, then what happened when the two choices met. Only the rule that fired is named. */
function Story(props: { fight: Fight; shown: number }) {
  const { fight, shown } = props;
  if (shown === 0) {
    return (
      <div class="story">
        <h3>The fight has not started</h3>
        <p>The ships start at {RANGE_NAME[fight.record.startRange]} distance. Press Next round to see what each ship chooses, or Play to let the rounds run by themselves.</p>
      </div>
    );
  }
  const s = roundSummary(fight.record, fight.doctrines, shown - 1);
  return (
    <div class="story" aria-live="polite">
      <h3>Round {s.round}: what the ships chose, and what happened</h3>
      {s.choices.map((c) => <p class="choice" style={{ borderLeftColor: SIDE_COLOUR[c.side] }}>{c.line}</p>)}
      <div class="meeting">{s.meeting.map((line) => <p>{line}</p>)}</div>
    </div>
  );
}

/** The browser's "reduce motion" setting. When it is on, nothing slides or flashes, but every word stays. */
function useCalm(): boolean {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [calm, setCalm] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const onChange = () => setCalm(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return calm;
}

/** The words for how a distance changed, shown on the distance track. */
function moveWords(m: Motion): string {
  if (m.escaped) return `Pulling apart: ${RANGE_NAME[m.rangeBefore]} to past Far`;
  if (m.direction === "closing") return `▶ ◀ Closing in: ${RANGE_NAME[m.rangeBefore]} to ${RANGE_NAME[m.rangeAfter]}`;
  if (m.direction === "opening") return `◀ ▶ Pulling apart: ${RANGE_NAME[m.rangeBefore]} to ${RANGE_NAME[m.rangeAfter]}`;
  return `Holding at ${RANGE_NAME[m.rangeAfter]}`;
}

// ---------- The page ----------

function Doctrines(props: { left: Pick; right: Pick }) {
  const sides: { side: BattleSide; pick: Pick }[] = [{ side: "hunter", pick: props.left }, { side: "target", pick: props.right }];
  return (
    <div class="panel">
      <h2>What each ship was told to do</h2>
      <p class="dim">A ship follows its doctrine: a list of rules. Each round it reads them from the top and obeys the first one that is true.</p>
      <div class="two log">
        {sides.map(({ side, pick }) => (
          <div>
            <h3 style={{ color: SIDE_COLOUR[side] }}>{side === "hunter" ? "Left" : "Right"}: {pickName(pick)}</h3>
            <ol>{doctrineWords(doctrineFor(pick)).map((line) => <li>{line}</li>)}</ol>
          </div>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const [left, setLeft] = useState<FightingStyle>("gunline");
  const [right, setRight] = useState<Pick>("boarder");
  const [seed, setSeed] = useState(1);
  const [fight, setFight] = useState<Fight | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const [animating, setAnimating] = useState(false);
  const deviceCalm = useCalm();
  const [animateChoice, setAnimateChoice] = useState<boolean | null>(null); // null: follow the device's reduce motion setting
  const calm = animateChoice === null ? deviceCalm : !animateChoice;

  // The page keeps what the timers need in refs, so a timer never reads an old render.
  const fightRef = useRef<Fight | null>(null);
  const shownRef = useRef(0);
  const calmRef = useRef(calm);
  const busy = useRef(false); // a round's animation is running
  const queued = useRef(false); // Next round was pressed while it ran
  const animTimer = useRef<number | undefined>(undefined);
  fightRef.current = fight;
  calmRef.current = calm;

  const total = fight?.record.rounds.length ?? 0;
  const done = fight !== null && shown >= total;

  /** Plays the next round with its animation. If an animation is still running, it finishes first and then this round plays. */
  const step = () => {
    const f = fightRef.current;
    if (!f) return;
    if (busy.current) { queued.current = true; return; }
    const n = shownRef.current;
    if (n >= f.record.rounds.length) return;
    shownRef.current = n + 1;
    setShown(n + 1);
    const ms = roundAnimMs(roundMotion(f.record, n), calmRef.current);
    if (ms <= 0) return;
    busy.current = true;
    setAnimating(true);
    animTimer.current = window.setTimeout(() => {
      busy.current = false;
      setAnimating(false);
      if (queued.current) { queued.current = false; step(); }
    }, ms);
  };

  const rewind = () => {
    window.clearTimeout(animTimer.current);
    busy.current = false;
    queued.current = false;
    shownRef.current = 0;
    setAnimating(false);
    setShown(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) return;
    if (done) { setPlaying(false); return; }
    if (animating) return; // the pause starts when the animation is over
    const timer = setTimeout(step, shown === 0 ? FIRST_ROUND_WAIT_MS : PAUSE_MS[speed]);
    return () => clearTimeout(timer);
  }, [playing, shown, done, animating, speed]);

  useEffect(() => () => window.clearTimeout(animTimer.current), []);

  const start = (withSeed: number) => {
    setSeed(withSeed);
    const next = runFight(left, right, withSeed);
    fightRef.current = next;
    setFight(next);
    rewind();
  };
  const newSeed = () => 1 + Math.floor(Math.random() * MAX_SEED);

  const ending = fight && done && !animating ? endingWords(fight.record, fight.doctrines) : null;
  const range = fight ? rangeAt(fight.record, shown) : null;
  const motion = fight && shown > 0 ? roundMotion(fight.record, shown - 1) : null;

  return (
    <main class={calm ? "calm" : ""}>
      <h1>Rumtide sandbox: battle viewer</h1>
      <p class="dim">Pick two ships and press Fight. The ships fight by themselves, following their rules. Then step through what happened.</p>

      <div class="panel">
        <div class="two">
          <div>
            <label for="left" style={{ color: SIDE_COLOUR.hunter }}>Left ship</label>
            <select id="left" value={left} onChange={(e) => setLeft(e.currentTarget.value as FightingStyle)}>
              {STYLE_PICKS.map((p) => <option value={p}>{pickName(p)}</option>)}
            </select>
          </div>
          <div>
            <label for="right" style={{ color: SIDE_COLOUR.target }}>Right ship</label>
            <select id="right" value={right} onChange={(e) => setRight(e.currentTarget.value as Pick)}>
              {RIGHT_PICKS.map((p) => <option value={p}>{pickName(p)}</option>)}
            </select>
          </div>
        </div>
        <div class="buttons">
          <button onClick={() => start(seed)}>Fight</button>
          <button class="plain" onClick={() => start(newSeed())} disabled={fight === null}>Fight again (new seed)</button>
        </div>
        <div style={{ marginTop: "12px", maxWidth: "220px" }}>
          <label for="seed">Seed (the same seed gives the same battle)</label>
          <input id="seed" type="number" min="0" value={seed} onInput={(e) => setSeed(Math.max(0, Math.floor(Number(e.currentTarget.value) || 0)))} />
        </div>
      </div>

      {fight && range ? (
        <div class="panel">
          <h2>{shown === 0 ? "Before the first round" : `After round ${shown} of ${total}`} (seed {fight.seed})</h2>
          <Picture fight={fight} shown={shown} calm={calm} />
          <div class="track">{RANGES.map((r) => <span class={r === range ? "on" : motion && r === motion.rangeBefore && r !== range ? "was" : ""}>{RANGE_NAME[r]}</span>)}</div>
          <p class="move">{motion ? moveWords(motion) : " "}</p>
          <div class="two">{SIDES.map((side) => <Bars fight={fight} shown={shown} side={side} motion={motion} calm={calm} />)}</div>
          <p class="dim">Hull is how much damage a ship can take. Rigging is its sails and ropes. Hands are its crew.</p>
          <Story fight={fight} shown={shown} />
          <div class="buttons">
            <button onClick={step} disabled={done}>Next round</button>
            <button onClick={() => setPlaying((p) => !p)} disabled={done}>{playing ? "Pause" : "Play"}</button>
            <button class="plain" onClick={rewind} disabled={shown === 0}>Back to the start</button>
            <div class="speed" role="group" aria-label="Play speed">
              <span>Speed:</span>
              {SPEEDS.map((v) => <button class={v === speed ? "on" : ""} aria-pressed={v === speed} onClick={() => setSpeed(v)}>{SPEED_NAME[v]}</button>)}
            </div>
          </div>
          <label class="check">
            <input type="checkbox" checked={!calm} onChange={(e) => setAnimateChoice(e.currentTarget.checked)} /> Animations
            {deviceCalm ? <span class="dim"> {calm ? "(your device asks for less motion, so they start off here. Tick to see them.)" : "(your device asks for less motion, but you turned them on here)"}</span> : null}
          </label>
        </div>
      ) : null}

      {ending ? (
        <div class="panel end">
          <h2>{ending.headline}</h2>
          <div class="how">{ending.how}</div>
          <p>{ending.why}</p>
        </div>
      ) : null}

      {fight && shown > 0 ? (
        <div class="panel">
          <h2>What happened, newest round first</h2>
          {Array.from({ length: shown }, (_, i) => shown - 1 - i).map((index) => {
            const log = roundLog(fight.record, fight.doctrines, index);
            return (
              <div class={index === shown - 1 ? "round current" : "round"}>
                <h3>{log.title}</h3>
                <div class="two log">
                  {log.ships.map((s) => (
                    <div>
                      <h3 style={{ color: SIDE_COLOUR[s.side] }}>{s.name}</h3>
                      <ul>{s.lines.map((line) => <li>{line}</li>)}</ul>
                    </div>
                  ))}
                </div>
                <ul style={{ marginTop: "6px" }}>{log.events.map((line) => <li>{line}</li>)}</ul>
              </div>
            );
          })}
        </div>
      ) : null}

      <Doctrines left={fight ? fight.picks.hunter : left} right={fight ? fight.picks.target : right} />
    </main>
  );
}
