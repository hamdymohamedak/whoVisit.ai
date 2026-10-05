import * as esbuild from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });

const watch = process.argv.includes("--watch");
const ctx = await esbuild.context({
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: !watch,
  outfile: "dist/v1.js",
  format: "iife",
  globalName: "WhoVisit",
  target: ["es2018"],
});

if (watch) {
  await ctx.watch();
  console.log("SDK watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("SDK built → dist/v1.js");
}
