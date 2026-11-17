// The closed beta's small rules, with no browser or server in them so they can be tested (D249 to D258).

export type BetaPage = "battle" | "tide" | "admin";

/** Which beta page a path asks for, or `null` for the game itself. `/sandbox` is the battle viewer. */
export function betaPage(pathname: string): BetaPage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/sandbox") return "battle";
  if (path === "/sandbox/tide") return "tide";
  if (path === "/sandbox/admin") return "admin";
  return null;
}

export const BETA_PATH: Record<BetaPage, string> = { battle: "/sandbox", tide: "/sandbox/tide", admin: "/sandbox/admin" };

export const MIN_TIDE = 1;
export const MAX_TIDE = 999;

/** The Tide one step on, or `null` when there is no such Tide. The database refuses bigger jumps too (RT409). */
export function stepTide(current: number, by: 1 | -1): number | null {
  const next = current + by;
  return next < MIN_TIDE || next > MAX_TIDE ? null : next;
}

/** A Tide number read from the database, or `null` for anything that is not a Tide. */
export function readTide(row: unknown): number | null {
  const tide = (row as { tide?: unknown } | null)?.tide;
  return typeof tide === "number" && Number.isInteger(tide) && tide >= MIN_TIDE && tide <= MAX_TIDE ? tide : null;
}

/** Ask for the new Tide in words: the button names the number and says what it does to everyone. */
export function advanceQuestion(current: number): string {
  return `Move everyone from Tide ${current} to Tide ${current + 1}? Every player's page changes to the new sea and starts with an empty plan.`;
}

export function backQuestion(current: number): string {
  return `Set the Tide back from ${current} to ${current - 1}? Plans already saved for Tide ${current - 1} come back, plans saved for Tide ${current} stay in the database.`;
}

export interface Submission { userId: string; email: string; submittedAt: string | null; style: string | null; steps: number }

/** Rows of `beta_submissions()` as the admin page lists them. Unreadable rows are dropped, not shown half empty. */
export function readSubmissions(rows: unknown): Submission[] {
  if (!Array.isArray(rows)) return [];
  const out: Submission[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown> | null;
    if (!r || typeof r.user_id !== "string" || typeof r.email !== "string") continue;
    out.push({
      userId: r.user_id,
      email: r.email,
      submittedAt: typeof r.submitted_at === "string" ? r.submitted_at : null,
      style: typeof r.style === "string" ? r.style : null,
      steps: typeof r.steps === "number" ? r.steps : 0,
    });
  }
  return out;
}

export function submittedCount(rows: Submission[]): number {
  return rows.filter((r) => r.submittedAt !== null).length;
}

/** "2 of 7 accounts have a plan saved". */
export function submissionSummary(rows: Submission[]): string {
  const n = submittedCount(rows);
  return `${n} of ${rows.length} ${rows.length === 1 ? "account has" : "accounts have"} a plan saved`;
}

const STEP_KINDS = ["sail", "survey", "land", "dock", "lurk", "repair"];
const MAX_STEPS = 6;

export interface StoredPlan { style: string; steps: Record<string, unknown>[] }

/** A saved plan read back from the database, or `null` if it does not look like one. The page checks the style
 *  and steps again against the engine, so this only keeps junk out of its state. */
export function readStoredPlan(value: unknown): StoredPlan | null {
  const v = value as { style?: unknown; steps?: unknown } | null;
  if (!v || typeof v.style !== "string" || !Array.isArray(v.steps) || v.steps.length > MAX_STEPS) return null;
  const steps: Record<string, unknown>[] = [];
  for (const s of v.steps) {
    const step = s as Record<string, unknown> | null;
    if (!step || typeof step.kind !== "string" || !STEP_KINDS.includes(step.kind)) return null;
    steps.push(step);
  }
  return { style: v.style, steps };
}
