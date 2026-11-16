// The sandbox battle viewer page (docs/briefs/sandbox.md, stage 1). Preact and plain SVG, no server, no login.
// The battle comes from setup.ts (the real engine_v3) and every sentence from words.ts.

import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { RANGES } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { BattleSide, FightingStyle, Range } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { C } from "../../client/src/palette.ts";
import { RIGHT_PICKS, STYLE_PICKS, doctrineFor, pickName, runFight } from "./setup.ts";
import type { Fight, Pick } from "./setup.ts";
import { RANGE_NAME, doctrineWords, endingWords, rangeAt, roundLog, shipsBySide, stateAt } from "./words.ts";

const SIDES: readonly BattleSide[] = ["hunter", "target"];
const SIDE_COLOUR: Record<BattleSide, string> = { hunter: C.gold, target: C.rose };
const PLAY_MS = 1600;
const MAX_SEED = 999999;

const CSS = `
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
  .bar { height: 12px; background: ${C.ink}; border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
  .bar div { height: 100%; }
  .barrow { display: flex; justify-content: space-between; font-size: 13px; }
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
  const tilt = props.sunk ? `rotate(${props.faces * 28}) translate(0 12)` : "";
  return (
    <g transform={`translate(${props.x} ${SEA_Y}) ${tilt} scale(${props.faces} 1)`} opacity={props.sunk ? 0.45 : 1}>
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

function Picture(props: { fight: Fight; shown: number }) {
  const { record } = props.fight;
  const done = props.shown >= record.rounds.length;
  const range = rangeAt(record, props.shown);
  const escaped = done && record.outcome.kind === "escaped";
  const gap = escaped ? MID - 8 : HALF_GAP[range];
  const round = record.rounds[props.shown - 1];
  const start = shipsBySide(record.ships);
  const state = stateAt(record, props.shown);
  const burning = (side: BattleSide): boolean => round?.ships.find((s) => s.ship === start[side].shipId)?.fire !== undefined;
  const sunk = (side: BattleSide): boolean => state[side].hull <= 0;
  return (
    <svg viewBox="0 0 320 110" role="img" aria-label={`The two ships at ${RANGE_NAME[range]} distance`}>
      <rect x="0" y="0" width="320" height="110" fill={C.deepSea} />
      <rect x="0" y={SEA_Y} width="320" height={110 - SEA_Y} fill={C.nightSea} />
      {RANGES.map((r) => [-1, 1].map((dir) => (
        <rect x={MID + dir * HALF_GAP[r] - 1} y={SEA_Y + 8} width="2" height={r === range ? 10 : 5} fill={r === range ? C.goldLight : C.dusk} />
      )))}
      {range === "grappled" && !escaped ? <line x1={MID - gap} y1={SEA_Y - 4} x2={MID + gap} y2={SEA_Y - 4} stroke={C.parchment} stroke-width="2" stroke-dasharray="3 2" /> : null}
      <Boat x={MID - gap} colour={SIDE_COLOUR.hunter} faces={1} monster={false} sunk={sunk("hunter")} burning={burning("hunter")} />
      <Boat x={MID + gap} colour={SIDE_COLOUR.target} faces={-1} monster={props.fight.picks.target === "shellback"} sunk={sunk("target")} burning={burning("target")} />
    </svg>
  );
}

function Bars(props: { fight: Fight; shown: number; side: BattleSide }) {
  const ship = shipsBySide(props.fight.record.ships)[props.side];
  const now = stateAt(props.fight.record, props.shown)[props.side];
  const rows: { name: string; now: number; max: number; colour: string }[] = [
    { name: "Hull", now: now.hull, max: ship.maxHullPoints, colour: C.clay },
    { name: "Rigging", now: now.rigging, max: ship.maxRiggingPoints, colour: C.mist },
    { name: "Hands", now: now.hands, max: ship.maxHands, colour: C.jungle },
  ];
  return (
    <div>
      <h3 style={{ color: SIDE_COLOUR[props.side] }}>{ship.name}</h3>
      {rows.map((row) => (
        <div>
          <div class="barrow"><span>{row.name}</span><span>{row.max > 0 ? `${Math.round(row.now)} of ${row.max}` : "none"}</span></div>
          <div class="bar"><div style={{ width: `${row.max > 0 ? Math.max(0, (row.now / row.max) * 100) : 0}%`, background: row.colour }} /></div>
        </div>
      ))}
    </div>
  );
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

function App() {
  const [left, setLeft] = useState<FightingStyle>("gunline");
  const [right, setRight] = useState<Pick>("boarder");
  const [seed, setSeed] = useState(1);
  const [fight, setFight] = useState<Fight | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);

  const total = fight?.record.rounds.length ?? 0;
  const done = fight !== null && shown >= total;

  useEffect(() => {
    if (!playing) return;
    if (done) { setPlaying(false); return; }
    const timer = setTimeout(() => setShown((n) => n + 1), PLAY_MS);
    return () => clearTimeout(timer);
  }, [playing, shown, done]);

  const start = (withSeed: number) => {
    setSeed(withSeed);
    setFight(runFight(left, right, withSeed));
    setShown(0);
    setPlaying(false);
  };
  const newSeed = () => 1 + Math.floor(Math.random() * MAX_SEED);

  const ending = fight && done ? endingWords(fight.record, fight.doctrines) : null;
  const range = fight ? rangeAt(fight.record, shown) : null;

  return (
    <main>
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
          <Picture fight={fight} shown={shown} />
          <div class="track">{RANGES.map((r) => <span class={r === range ? "on" : ""}>{RANGE_NAME[r]}</span>)}</div>
          <div class="two">{SIDES.map((side) => <Bars fight={fight} shown={shown} side={side} />)}</div>
          <p class="dim">Hull is how much damage a ship can take. Rigging is its sails and ropes. Hands are its crew.</p>
          <div class="buttons">
            <button onClick={() => setShown((n) => Math.min(total, n + 1))} disabled={done}>Next round</button>
            <button onClick={() => setPlaying((p) => !p)} disabled={done}>{playing ? "Pause" : "Play"}</button>
            <button class="plain" onClick={() => { setShown(0); setPlaying(false); }} disabled={shown === 0}>Back to the start</button>
          </div>
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
              <div class="round">
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

const style = document.createElement("style");
style.textContent = CSS;
document.head.append(style);
render(<App />, document.getElementById("app")!);
