/**
 * Demo only: how YOUR backend would look after you copy templates/whoVisit.
 * Not part of WhoVisit runtime.
 *
 *   pnpm run build
 *   WHOVISIT_ROOT=$PWD node examples/host-server.js
 */
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { attachWhoVisit } from "../templates/whoVisit/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const app = express();

app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html><html><body>
<h1>My site</h1>
<p>WhoVisit tracks this page automatically.</p>
<script src="/whovisit/embed.js"></script>
</body></html>`);
});

await attachWhoVisit(app, {
  settingsPath: join(root, "examples/host-settings.json"),
  whoVisitRoot: process.env.WHOVISIT_ROOT || root,
});

const port = 3000;
app.listen(port, () => {
  console.log(`Host app http://localhost:${port}`);
  console.log(
    `Frontend (same host demo): <script src="http://localhost:${port}/whovisit/embed.js"></script>`
  );
  console.log(
    `Separate frontend would use the FULL backend URL above, not /whovisit/embed.js relative to the SPA.`
  );
});
