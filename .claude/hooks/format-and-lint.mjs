// PostToolUse hook: formats edited files with Prettier and lints JS/TS with ESLint.
// Exit 2 + stderr sends unfixable ESLint errors back to Claude.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectDir = path.resolve(
  process.env.CLAUDE_PROJECT_DIR ?? path.join(import.meta.dirname, "..", ".."),
);
const LINTABLE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const rawPath = input?.tool_input?.file_path;
if (!rawPath) process.exit(0);

const file = path.resolve(projectDir, rawPath);
const rel = path.relative(projectDir, file);
const outside = rel.startsWith("..") || path.isAbsolute(rel);
const ignored = /(^|[\\/])(node_modules|\.next|\.git)([\\/]|$)/.test(rel);
if (outside || ignored || !existsSync(file)) process.exit(0);

const bin = (p) => path.join(projectDir, "node_modules", p);
const run = (script, args) =>
  spawnSync(process.execPath, [bin(script), ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });

const prettier = bin("prettier/bin/prettier.cjs");
if (existsSync(prettier)) {
  const res = run("prettier/bin/prettier.cjs", [
    "--write",
    "--ignore-unknown",
    "--log-level",
    "warn",
    file,
  ]);
  if (res.status !== 0) {
    process.stderr.write(
      `Prettier failed on ${rel}:\n${res.stderr || res.stdout}`,
    );
    process.exit(2);
  }
}

if (
  LINTABLE.has(path.extname(file)) &&
  existsSync(bin("eslint/bin/eslint.js"))
) {
  const res = run("eslint/bin/eslint.js", [
    "--fix",
    "--no-warn-ignored",
    "--max-warnings",
    "0",
    file,
  ]);
  if (res.status !== 0) {
    process.stderr.write(
      `ESLint found problems in ${rel}:\n${res.stdout}${res.stderr}`,
    );
    process.exit(2);
  }
}

process.exit(0);
