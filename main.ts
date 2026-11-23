// Token Radar's entrypoint (Node 22, standard library only): radar-10.
//
// The program reads the sealed snapshot, scores the watchlist plus the early
// radar below the floor with the model in lib/model.ts, writes the ranked board
// to board.json, writes the dashboard's data beside the page as data.js, and
// copies this repository's dashboard/ and screenshots/ into the output
// directory. Last, it writes dossier.json, the summary the judge reads, with
// the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network:
// dashboard/index.html, dashboard/app.css and dashboard/app.js read data.js,
// which this program writes from the same board. The page renders every row
// from the snapshot figures, so the code the judge reads and the board the
// gate checks are visibly the same arithmetic.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardProblem, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_CAP = 65_536;
const SHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASH_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The value of `--name <value>` (or `--name=<value>`), else `fallback`. */
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

/** Die with a message on stderr and a non-zero exit. */
function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputArg = flag('input', '/input');
const inputPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputPath)) {
  fail(`no snapshot at ${inputPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snap = parseSnapshot(readFileSync(inputPath, 'utf8'));
const { board, radar } = buildRadar(snap);
const problem = boardProblem(board, snap);
if (problem !== null) fail(`the model wrote a board the gate refuses: ${problem}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Copy a directory's regular files into `to`, skipping dot-names. Returns the names copied. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, name));
    names.push(name);
  }
  return names;
}

const dashFiles = copyDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
const shots = copyDir(join(here, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
for (const name of shots) {
  if (!SHOT_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: TEXT_CAP, screenshots: SHOT_CAPS, dashboard: DASH_CAPS }),
);

process.stdout.write(
  `token radar: ${snap.protocols.length} protocols, ${snap.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.coverage.early_below_floor} early below the floor, ${radar.coverage.early_above_floor} above it, ${radar.coverage.live_shown} live shown)\n` +
    `token radar: LOO ${radar.calibration.spearman} (top decile ${radar.calibration.top_decile_hit}/${radar.calibration.top_decile_total}), walk-forward ${radar.walk_forward.mean_spearman}, bootstrap median width ${radar.bootstrap.median_width}\n` +
    `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (${dashFiles.length} files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
);
