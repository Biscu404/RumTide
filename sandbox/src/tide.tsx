// The sandbox Tide page (docs/briefs/sandbox.md, stage 2). Preact and plain SVG, no server, no login.
// The Tide comes from tideSetup.ts (the real engine_v3) and every sentence from tideWords.ts and stage 1's words.ts.
// The battle viewer of stage 1 is its own page (index.html, main.tsx) and shares no state with this one.

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { FIGHTING_STYLES, LEVEL, laneVisible, levelOf, styleTemplate, templateDoctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  Captain, FightingStyle, HuntFilter, ReplayEvent, SeasonState, ShipId, Stance, Step, Terrain, TideResult, WaterId,
} from "../../supabase/functions/_shared/engine_v3/index.ts";
import { C } from "../../client/src/palette.ts";
import { doctrineWords } from "./words.ts";
import {
  BOTS, LAST_WATCH, YOU, YOUR_SHIP, estimatePlan, involves, knownSites, knownWaters, newTide, planProblems, runTide, spotsAt, stepsAllowed,
  watchOf, world, you,
} from "./tideSetup.ts";
import type { Spot, TideSetup } from "./tideSetup.ts";
import {
  FILTER_PICKS, STANCE_WORDS, STEP_HINT, TERRAIN_NAME, battleWords, clockWords, estimateWords, eventWords, newlyCharted, othersWords,
  stepWords, summaryRows, windWords,
} from "./tideWords.ts";

const PLAY_MS = 1500;
const MAX_SEED = 999999;

const TERRAIN_COLOUR: Record<Terrain, string> = {
  open: C.deepSea, shallows: C.shallows, reef: C.plum, rocky: C.dusk, fog: C.mist, kelp: C.jungleDark, strongCurrent: C.highlight, harbour: C.sand,
};

/** Each ship's colour and letter on the map. The letter is there so nobody has to tell ships apart by colour alone. */
const MARK: Record<ShipId, { colour: string; letter: string }> = {
  [YOUR_SHIP]: { colour: C.gold, letter: "Y" },
  ship_cap_anna: { colour: C.rose, letter: "S" },
  ship_cap_bogdan: { colour: C.highlight, letter: "W" },
  ship_cap_dragos: { colour: C.jungle, letter: "B" },
  ship_cap_biscuit: { colour: C.foam, letter: "O" },
};

export const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.ink}; color: ${C.parchment}; font: 16px/1.45 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: ${C.gold}; }
  h2 { font-size: 17px; margin: 0 0 8px; color: ${C.goldLight}; }
  h3 { font-size: 15px; margin: 0 0 4px; }
  p { margin: 0 0 8px; }
  a { color: ${C.highlight}; }
  .dim { color: ${C.mist}; font-size: 14px; }
  .warn { color: ${C.rose}; font-size: 14px; }
  .panel { background: ${C.nightSea}; border: 2px solid ${C.slate}; border-radius: 6px; padding: 12px; margin: 12px 0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  label { display: block; font-size: 14px; margin-bottom: 4px; }
  select, input[type=number] { width: 100%; padding: 10px 8px; font: inherit; color: ${C.ink}; background: ${C.parchment}; border: 2px solid ${C.wood}; border-radius: 4px; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  button { padding: 10px 14px; font: inherit; font-weight: 600; color: ${C.ink}; background: ${C.gold}; border: 2px solid ${C.goldLight}; border-radius: 4px; cursor: pointer; }
  button.plain { background: ${C.mist}; border-color: ${C.foam}; }
  button.small { padding: 6px 10px; font-size: 14px; }
  button:disabled { opacity: 0.45; cursor: default; }
  svg { display: block; width: 100%; height: auto; border-radius: 4px; }
  svg.chart { max-width: 470px; margin: 0 auto; }
  svg text { font-family: system-ui, sans-serif; }
  .water { cursor: pointer; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 8px 0; font-size: 13px; }
  .chips i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; border: 1px solid ${C.ink}; }
  .who { display: grid; grid-template-columns: 26px 1fr; gap: 6px 8px; font-size: 14px; margin-top: 8px; }
  .dot { width: 22px; height: 22px; border-radius: 50%; color: ${C.ink}; font-weight: 700; font-size: 13px; text-align: center; line-height: 22px; }
  .step { border-top: 2px solid ${C.slate}; padding-top: 10px; margin-top: 10px; }
  .step:first-of-type { border-top: 0; margin-top: 0; padding-top: 0; }
  .stephead { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
  ol, ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 4px; font-size: 14px; }
  li.mine { color: ${C.goldLight}; }
  .watch { border-top: 2px solid ${C.slate}; padding-top: 10px; margin-top: 10px; }
  .watch:first-of-type { border-top: 0; margin-top: 0; padding-top: 0; }
  .battle { border: 2px solid ${C.gold}; border-radius: 6px; padding: 10px; margin: 8px 0; background: ${C.ink}; }
  .how { display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${C.gold}; color: ${C.ink}; font-weight: 700; margin-bottom: 6px; }
  details { margin-top: 8px; }
  summary { cursor: pointer; font-size: 14px; color: ${C.highlight}; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td, th { text-align: left; padding: 4px 6px 4px 0; border-bottom: 1px solid ${C.slate}; vertical-align: top; }
  td.changed { color: ${C.goldLight}; font-weight: 700; }
  .check { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; }
  .check input { width: 20px; height: 20px; }
  @media (max-width: 520px) { .two { grid-template-columns: 1fr; } main { padding: 10px; } }
`;

// ---------- The map ----------

const UNIT = 14; // picture units for one map unit
const PAD = 40;

interface Fight { x: number; y: number }

function SeaMap(props: { captain: Captain; spots: Record<ShipId, Spot>; paths?: WaterId[][]; fights?: Fight[]; onPick?: (water: WaterId) => void }) {
  const k = props.captain.knowledge;
  const waters = knownWaters(props.captain);
  const xs = waters.map((w) => w.x), ys = waters.map((w) => w.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = (Math.max(...xs) - minX) * UNIT + PAD * 2, height = (Math.max(...ys) - minY) * UNIT + PAD * 2 + 8;
  const px = (x: number) => (x - minX) * UNIT + PAD, py = (y: number) => (y - minY) * UNIT + PAD;
  const lanes = world.map.lanes.filter((l) => laneVisible(world, k, l.id) && levelOf(k, l.id) >= LEVEL.sketched && world.water[l.a] && world.water[l.b]
    && levelOf(k, l.a) >= LEVEL.rumoured && levelOf(k, l.b) >= LEVEL.rumoured);
  // Ships in the same spot stand side by side above it.
  const groups = new Map<string, ShipId[]>();
  for (const id of Object.keys(props.spots).sort()) {
    const s = props.spots[id] as Spot;
    const key = `${s.x.toFixed(2)}|${s.y.toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  return (
    <svg class="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Your chart of the Cradle Isles, with every ship on it">
      <rect x="0" y="0" width={width} height={height} fill={C.ink} />
      {lanes.map((l) => {
        const a = world.water[l.a]!, b = world.water[l.b]!;
        return <line x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} stroke={C.dusk} stroke-width="3" stroke-dasharray={levelOf(k, l.id) >= LEVEL.charted ? undefined : "5 4"} />;
      })}
      {(props.paths ?? []).map((path) => (
        <polyline points={path.map((id) => `${px(world.water[id]!.x)},${py(world.water[id]!.y)}`).join(" ")} fill="none" stroke={C.goldLight} stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round" />
      ))}
      {waters.map((w) => {
        const words = w.name.split(" ");
        const last = words.length > 1 ? words.pop() : undefined;
        return (
          <g class={props.onPick ? "water" : ""} onClick={() => props.onPick?.(w.id)}>
            <title>{`${w.name} (${TERRAIN_NAME[w.terrain]})`}</title>
            <circle cx={px(w.x)} cy={py(w.y)} r="11" fill={TERRAIN_COLOUR[w.terrain]} stroke={levelOf(k, w.id) >= LEVEL.charted ? C.foam : C.steel} stroke-width="2" stroke-dasharray={levelOf(k, w.id) >= LEVEL.charted ? undefined : "3 3"} />
            <text x={px(w.x)} y={py(w.y) + 23} text-anchor="middle" font-size="9" fill={C.parchment}>{words.join(" ")}</text>
            {last ? <text x={px(w.x)} y={py(w.y) + 33} text-anchor="middle" font-size="9" fill={C.parchment}>{last}</text> : null}
          </g>
        );
      })}
      {(props.fights ?? []).map((f) => (
        <path transform={`translate(${px(f.x)} ${py(f.y)})`} d="M 0 -17 L 4 -6 L 16 -8 L 7 0 L 16 8 L 4 6 L 0 17 L -4 6 L -16 8 L -7 0 L -16 -8 L -4 -6 Z" fill={C.danger} stroke={C.goldLight} stroke-width="1.5" opacity="0.9" />
      ))}
      {[...groups.values()].flatMap((ids) => ids.map((id, i) => {
        const s = props.spots[id] as Spot, mark = MARK[id] ?? { colour: C.mist, letter: "?" };
        const x = px(s.x) + (i - (ids.length - 1) / 2) * 17, y = py(s.y) - (s.water ? 17 : 0);
        return (
          <g>
            <circle cx={x} cy={y} r="8" fill={mark.colour} stroke={C.ink} stroke-width={id === YOUR_SHIP ? 3 : 1.5} />
            <text x={x} y={y + 3.5} text-anchor="middle" font-size="10" font-weight="700" fill={C.ink}>{mark.letter}</text>
          </g>
        );
      }))}
    </svg>
  );
}

function MapKey(props: { captain: Captain }) {
  const terrains = [...new Set(knownWaters(props.captain).map((w) => w.terrain))];
  return (
    <>
      <div class="chips">{terrains.map((t) => <span><i style={{ background: TERRAIN_COLOUR[t] }} />{TERRAIN_NAME[t]}</span>)}</div>
      <p class="dim">A solid ring or line is Charted: you know it well. A dotted one is only a sketch, so your Watch counts there are guesses.</p>
    </>
  );
}

function Who(props: { state: SeasonState; style: FightingStyle }) {
  return (
    <div class="who">
      <div class="dot" style={{ background: MARK[YOUR_SHIP]!.colour }}>Y</div>
      <div><b>You</b>, a {styleTemplate(props.style)}, docked in Gullhaven Harbour with 120 doubloons safe in your chest.</div>
      {BOTS.map((bot) => {
        const ship = props.state.ships[`ship_${bot.spec.id}`]!, mark = MARK[ship.id]!;
        return (
          <>
            <div class="dot" style={{ background: mark.colour }}>{mark.letter}</div>
            <div><b>{ship.name}</b>{bot.spec.name !== ship.name ? ` (${bot.spec.name})` : ""}{bot.spec.style ? `, a ${styleTemplate(bot.spec.style)}` : ""}. {bot.about}</div>
          </>
        );
      })}
    </div>
  );
}

// ---------- The planner ----------

const NEW_STEP: Record<Step["kind"], (setup: TideSetup, at: WaterId) => Step> = {
  sail: (setup, at) => ({ kind: "sail", to: knownWaters(you(setup.state)).find((w) => w.id !== at)!.id, stance: "trade" }),
  survey: () => ({ kind: "survey" }),
  land: (setup) => ({ kind: "land", site: knownSites(you(setup.state))[0]!.id }),
  dock: () => ({ kind: "dock" }),
  lurk: () => ({ kind: "lurk", filter: { kind: "anyone" } }),
  repair: () => ({ kind: "repair" }),
};

const STEP_BUTTON: Record<Step["kind"], string> = { sail: "Sail to", survey: "Survey", land: "Land", dock: "Dock", lurk: "Lie in wait", repair: "Repair" };
const STEP_KINDS: readonly Step["kind"][] = ["sail", "lurk", "dock", "survey", "land", "repair"];

function FilterSelect(props: { id: string; label: string; value: HuntFilter | undefined; onPick: (f: HuntFilter) => void }) {
  return (
    <div>
      <label for={props.id}>{props.label}</label>
      <select id={props.id} value={props.value?.kind ?? "anyone"} onChange={(e) => props.onPick(FILTER_PICKS.find((p) => p.filter.kind === e.currentTarget.value)!.filter)}>
        {FILTER_PICKS.map((p) => <option value={p.filter.kind}>{p.words}</option>)}
      </select>
    </div>
  );
}

function StepEditor(props: { setup: TideSetup; step: Step; index: number; onChange: (s: Step) => void }) {
  const { step, index } = props;
  const captain = you(props.setup.state);
  if (step.kind === "sail") {
    return (
      <div class="two">
        <div>
          <label for={`to${index}`}>Where to</label>
          <select id={`to${index}`} value={step.to} onChange={(e) => props.onChange({ ...step, to: e.currentTarget.value })}>
            {knownWaters(captain).map((w) => <option value={w.id}>{w.name} ({TERRAIN_NAME[w.terrain]})</option>)}
          </select>
        </div>
        <div>
          <label for={`stance${index}`}>How you sail</label>
          <select id={`stance${index}`} value={step.stance ?? "trade"} onChange={(e) => {
            const stance = e.currentTarget.value as Stance;
            props.onChange({ kind: "sail", to: step.to, stance, ...(stance === "hunt" ? { filter: step.filter ?? { kind: "anyone" } } : {}) });
          }}>
            {(Object.keys(STANCE_WORDS) as Stance[]).map((s) => <option value={s}>{STANCE_WORDS[s]}</option>)}
          </select>
        </div>
        {step.stance === "hunt" ? <FilterSelect id={`filter${index}`} label="Who you attack" value={step.filter} onPick={(filter) => props.onChange({ ...step, filter })} /> : null}
      </div>
    );
  }
  if (step.kind === "lurk") {
    return (
      <div class="two">
        <FilterSelect id={`filter${index}`} label="Who you jump" value={step.filter} onPick={(filter) => props.onChange({ ...step, filter })} />
        <div>
          <label for={`range${index}`}>How far off the fight starts</label>
          <select id={`range${index}`} value={step.ambushRange ?? "medium"} onChange={(e) => props.onChange({ ...step, ambushRange: e.currentTarget.value as "long" | "medium" })}>
            <option value="medium">Medium distance</option>
            <option value="long">Long distance</option>
          </select>
        </div>
      </div>
    );
  }
  if (step.kind === "land") {
    return (
      <div>
        <label for={`site${index}`}>Where you go ashore</label>
        <select id={`site${index}`} value={step.site} onChange={(e) => props.onChange({ ...step, site: e.currentTarget.value })}>
          {knownSites(captain).map((s) => <option value={s.id}>{s.name}, on {world.island[s.island]?.name}</option>)}
        </select>
      </div>
    );
  }
  return null;
}

function Planner(props: { setup: TideSetup; steps: Step[]; setSteps: (s: Step[]) => void; onReady: () => void }) {
  const { setup, steps } = props;
  const plan = { steps };
  const est = estimatePlan(setup, plan);
  const slots = stepsAllowed(setup);
  const problems = planProblems(setup, plan);
  const swap = (i: number, s: Step) => props.setSteps(steps.map((old, j) => (j === i ? s : old)));
  return (
    <div class="panel">
      <h2>Your voyage</h2>
      <p class="dim">
        A Tide is one turn. You give your ship up to {slots} steps, press Ready, and it carries them out by itself while every other ship does the same.
        Your ship has {est.total} Watches to spend this Tide. Tap a water on the chart to add a step that sails there.
      </p>
      {steps.length === 0 ? <p>No steps yet. With no steps your ship stays safely docked.</p> : null}
      {steps.map((step, i) => (
        <div class="step">
          <div class="stephead">
            <h3>Step {i + 1}: {stepWords(step)}</h3>
            <button class="plain small" onClick={() => props.setSteps(steps.filter((_, j) => j !== i))}>Remove</button>
          </div>
          <StepEditor setup={setup} step={step} index={i} onChange={(s) => swap(i, s)} />
          <p class={est.steps[i]?.problem ? "warn" : "dim"} style={{ marginTop: "6px" }}>{estimateWords(step, est.steps[i]!)}</p>
          <p class="dim">{STEP_HINT[step.kind]}</p>
        </div>
      ))}
      <div class="step">
        <h3>Add a step ({steps.length} of {slots} used)</h3>
        <div class="buttons" style={{ marginTop: "6px" }}>
          {STEP_KINDS.map((kind) => (
            <button class="plain small" disabled={steps.length >= slots} onClick={() => props.setSteps([...steps, NEW_STEP[kind](setup, est.endsAt)])}>{STEP_BUTTON[kind]}</button>
          ))}
        </div>
      </div>
      <div class="step">
        <p>Your plan uses about <b>{est.used} of {est.total}</b> Watches{steps.length > 0 ? ` and ends at ${world.water[est.endsAt]?.name}` : ""}. Watches you do not use are lost.</p>
        {problems.map((p) => <p class="warn">{p}</p>)}
        <div class="buttons">
          <button disabled={problems.length > 0} onClick={props.onReady}>Ready</button>
          <button class="plain" disabled={steps.length === 0} onClick={() => props.setSteps([])}>Clear the plan</button>
        </div>
      </div>
    </div>
  );
}

// ---------- What happened ----------

type BattleEvent = Extract<ReplayEvent, { kind: "battle" }>;

function Battle(props: { event: BattleEvent; before: SeasonState }) {
  const card = battleWords(props.event, props.before);
  return (
    <div class="battle">
      <h3>Battle: {card.title}</h3>
      <p class="dim">{card.start}</p>
      <div class="how">{card.ending.how}</div>
      <p><b>{card.ending.headline}.</b> {card.ending.why}</p>
      <ul>{card.after.map((line) => <li>{line}</li>)}</ul>
      <details>
        <summary>Show the battle round by round ({card.rounds.length} rounds)</summary>
        {card.rounds.map((log) => (
          <div class="watch">
            <h3>{log.title}</h3>
            {log.ships.map((s) => (
              <>
                <p style={{ margin: "4px 0 2px", fontSize: "14px" }}><b>{s.name}</b></p>
                <ul>{s.lines.map((line) => <li>{line}</li>)}</ul>
              </>
            ))}
            <ul style={{ marginTop: "6px" }}>{log.events.map((line) => <li>{line}</li>)}</ul>
          </div>
        ))}
      </details>
    </div>
  );
}

function Outcome(props: { setup: TideSetup; result: TideResult; steps: Step[]; onAgain: () => void; onNewSea?: () => void }) {
  const { setup, result } = props;
  const before = setup.state;
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const done = shown >= LAST_WATCH;

  useEffect(() => {
    if (!playing) return;
    if (done) { setPlaying(false); return; }
    const timer = setTimeout(() => setShown((n) => n + 1), PLAY_MS);
    return () => clearTimeout(timer);
  }, [playing, shown, done]);

  const spots = spotsAt(before, result, shown);
  const mine = (e: ReplayEvent) => involves(e, YOUR_SHIP, YOU);
  const fights: Fight[] = result.replay.flatMap((e) => {
    if (e.kind !== "encounter" || watchOf(e) !== shown) return [];
    if (!e.onLane) { const w = world.water[e.at]!; return [{ x: w.x, y: w.y }]; }
    const lane = world.lane[e.at]!, a = world.water[lane.a]!, b = world.water[lane.b]!;
    return [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
  });
  const captainNow = done ? you(result.state) : you(before);
  const charted = newlyCharted(before, result);

  return (
    <>
      <div class="panel">
        <h2>{clockWords(shown)} (seed {setup.seed})</h2>
        <p class="dim">Your orders: {props.steps.length > 0 ? props.steps.map(stepWords).join(", then ") : "stay docked"}.</p>
        <SeaMap captain={captainNow} spots={spots} fights={fights} />
        <MapKey captain={captainNow} />
        <div class="buttons">
          <button onClick={() => setShown((n) => Math.min(LAST_WATCH, n + 1))} disabled={done}>Next Watch</button>
          <button onClick={() => setPlaying((p) => !p)} disabled={done}>{playing ? "Pause" : "Play"}</button>
          <button class="plain" onClick={() => { setShown(LAST_WATCH); setPlaying(false); }} disabled={done}>Skip to the end</button>
          <button class="plain" onClick={() => { setShown(0); setPlaying(false); }} disabled={shown === 0}>Back to the start</button>
        </div>
      </div>

      {done ? (
        <div class="panel" style={{ borderColor: C.gold }}>
          <h2>How your Tide went</h2>
          <table>
            <tr><th></th><th>Before</th><th>After</th></tr>
            {summaryRows(before, result).map((row) => <tr><td>{row.name}</td><td>{row.was}</td><td class={row.changed ? "changed" : ""}>{row.now}</td></tr>)}
          </table>
          {charted.length > 0 ? <p style={{ marginTop: "8px" }}>Newly Charted: {charted.join(", ")}.</p> : null}
          <h3 style={{ marginTop: "10px" }}>The others</h3>
          <ul>{othersWords(result).map((line) => <li>{line}</li>)}</ul>
          <div class="buttons">
            <button onClick={props.onAgain}>Plan this Tide again</button>
            {props.onNewSea ? <button class="plain" onClick={props.onNewSea}>Try a new sea (new seed)</button> : null}
          </div>
          <p class="dim" style={{ marginTop: "8px" }}>Planning again keeps the same sea: the same wind and the same plans for the other captains, so you can see what a different voyage would have done.</p>
        </div>
      ) : null}

      <div class="panel">
        <h2>What happened, newest first</h2>
        <label class="check"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.currentTarget.checked)} />Show only what my ship was part of</label>
        {Array.from({ length: shown + 1 }, (_, i) => shown - i).map((watch) => {
          const events = result.replay.filter((e) => watchOf(e) === watch && (!onlyMine || mine(e)));
          if (events.length === 0) return null;
          return (
            <div class="watch">
              <h3>{clockWords(watch)}</h3>
              <ul>
                {events.map((e) => {
                  if (e.kind === "battle") return <Battle event={e} before={before} />;
                  const line = eventWords(e, before);
                  return line ? <li class={mine(e) && e.kind !== "tideStart" && e.kind !== "tideEnd" ? "mine" : ""}>{line}</li> : null;
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- The page ----------

/** The closed beta on the live site (D249 to D258). The sea is fixed by the shared Tide number, so everyone who
 *  plans Tide 3 sees the same wind and the same other captains. The plan is handed up on every change and the
 *  site saves it. Remount the page (a new `key`) when the Tide changes: `saved` is only read at the start. */
export interface BetaLink {
  tide: number;
  saved: { style: string; steps: Record<string, unknown>[] } | null;
  saveNote: string;
  onChange: (plan: { style: FightingStyle; steps: Step[] }) => void;
}

/** A saved plan can be old or hand edited, so it is checked against the engine before it is trusted. */
function startingPlan(saved: BetaLink["saved"], tide: number): { style: FightingStyle; steps: Step[] } {
  const style = (FIGHTING_STYLES as readonly string[]).includes(saved?.style ?? "") ? (saved!.style as FightingStyle) : "gunline";
  const steps = (saved?.steps ?? []) as Step[];
  try {
    estimatePlan(newTide(style, tide), { steps });
    return { style, steps };
  } catch {
    return { style, steps: [] };
  }
}

export function App({ beta }: { beta?: BetaLink }) {
  const start = useMemo(() => beta ? startingPlan(beta.saved, beta.tide) : { style: "gunline" as FightingStyle, steps: [] as Step[] }, []);
  const [style, setStyle] = useState<FightingStyle>(start.style);
  const [seed, setSeed] = useState(beta ? beta.tide : 1);
  const [steps, setSteps] = useState<Step[]>(beta ? start.steps : []);
  const [result, setResult] = useState<TideResult | null>(null);
  const setup = useMemo(() => newTide(style, seed), [style, seed]);
  const captain = you(setup.state);
  // A plan from an older version of the rules can name a water or site that is gone: show the problems, never crash.
  const est = estimatePlan(setup, { steps });
  const slots = stepsAllowed(setup);
  const newSea = () => { setSeed(1 + Math.floor(Math.random() * MAX_SEED)); setResult(null); };
  // Hand every change of the plan up, but not the plan the page started with, or opening the page would count as saving one.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    beta?.onChange({ style, steps });
  }, [style, steps]);

  return (
    <main>
      <h1>{beta ? `Rumtide beta: Tide ${beta.tide}` : "Rumtide sandbox: one Tide"}</h1>
      <p class="dim">
        You and four other captains share the Cradle Isles for one Tide. Plan a voyage, press Ready and watch what happened.
        {beta ? " Everyone in the beta sees the same sea this Tide. Your plan is saved as you change it." : <> The <a href="./">battle viewer</a> is its own page.</>}
      </p>
      {beta ? <p class="dim" role="status">{beta.saveNote}</p> : null}

      {result === null ? (
        <>
          <div class="panel">
            <div class="two">
              <div>
                <label for="style">Your Fighting Style</label>
                <select id="style" value={style} onChange={(e) => setStyle(e.currentTarget.value as FightingStyle)}>
                  {FIGHTING_STYLES.map((s) => <option value={s}>{styleTemplate(s)}</option>)}
                </select>
              </div>
              <div>
                <label for="seed">{beta ? `Sea (the sea of Tide ${beta.tide}, the same for everyone)` : "Seed (the same seed gives the same sea)"}</label>
                <input id="seed" type="number" min="0" value={seed} disabled={!!beta} onInput={(e) => setSeed(Math.max(0, Math.floor(Number(e.currentTarget.value) || 0)))} />
              </div>
            </div>
            {beta ? null : <div class="buttons"><button class="plain small" onClick={newSea}>New seed</button></div>}
            <details>
              <summary>How your ship fights if it comes to a battle</summary>
              <p class="dim" style={{ marginTop: "6px" }}>You do not steer a battle. Your ship follows these rules: each round it reads them from the top and obeys the first one that is true.</p>
              <ol>{doctrineWords(templateDoctrine(styleTemplate(style))).map((line) => <li>{line}</li>)}</ol>
            </details>
          </div>

          <div class="panel">
            <h2>The sea before the Tide</h2>
            <p>The wind this Tide: <b>{windWords(setup.winds.cradle!)}</b>. It makes some stretches quicker and some slower.</p>
            <SeaMap captain={captain} spots={spotsAt(setup.state, { state: setup.state, replay: [], encounters: [] }, 0)} paths={est.steps.map((s) => s.path).filter((p) => p.length > 1)}
              onPick={(water) => { if (steps.length < slots && water !== est.endsAt) setSteps([...steps, { kind: "sail", to: water, stance: "trade" }]); }} />
            <MapKey captain={captain} />
            <h3>Who is out there</h3>
            <p class="dim">You know where the others were last seen, not what they plan.</p>
            <Who state={setup.state} style={style} />
          </div>

          <Planner setup={setup} steps={steps} setSteps={setSteps} onReady={() => setResult(runTide(setup, { steps }))} />
        </>
      ) : (
        <Outcome setup={setup} result={result} steps={steps} onAgain={() => setResult(null)} onNewSea={beta ? undefined : () => { setSteps([]); newSea(); }} />
      )}
    </main>
  );
}
