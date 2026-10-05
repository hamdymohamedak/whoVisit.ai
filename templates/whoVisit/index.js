/**
 * You create this folder yourself inside YOUR backend project.
 *
 * From the WhoVisit repo (or npm):
 *   cp -r templates/whoVisit ./whoVisit
 *   cp whoVisit/settings.example.json whoVisit/settings.json
 *
 * server.js (only change):
 *   import { attachWhoVisit } from "./whoVisit/index.js";
 *   await attachWhoVisit(app);
 *
 * Frontend:
 *   <script src="/whovisit/embed.js"></script>
 */

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readFileSync, existsSync } from "fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SETTINGS = join(__dirname, "settings.json");

/**
 * Resolve the WhoVisit API embed entry.
 * Order:
 *  1) options.whoVisitRoot  — path to cloned WhoVisit repo
 *  2) env WHOVISIT_ROOT
 *  3) npm package @whovisit/api (if installed)
 */
async function loadAttach(whoVisitRoot) {
  if (whoVisitRoot) {
    const embed = join(
      resolve(whoVisitRoot),
      "packages/api/dist/embed/express.js"
    );
    if (!existsSync(embed)) {
      throw new Error(
        `[WhoVisit] Build the WhoVisit repo first (pnpm run build).\nMissing: ${embed}`
      );
    }
    return import(embed);
  }

  try {
    return await import("@whovisit/api/embed");
  } catch {
    throw new Error(
      `[WhoVisit] Install @whovisit/api OR pass whoVisitRoot / set WHOVISIT_ROOT to the cloned repo path.`
    );
  }
}

export async function attachWhoVisit(expressApp, options = {}) {
  const settingsPath = options.settingsPath ?? DEFAULT_SETTINGS;

  if (!existsSync(settingsPath)) {
    throw new Error(
      `[WhoVisit] Missing ${settingsPath}. Copy settings.example.json → settings.json`
    );
  }

  const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  const dbRel = settings.database?.path ?? "./data/whovisit.db";
  process.env.DATABASE_URL = join(dirname(settingsPath), dbRel);

  const whoVisitRoot =
    options.whoVisitRoot ?? process.env.WHOVISIT_ROOT ?? undefined;

  const { attachWhoVisitToExpress } = await loadAttach(whoVisitRoot);

  return attachWhoVisitToExpress(expressApp, { settingsPath, settings });
}
