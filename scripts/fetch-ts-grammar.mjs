// Copies VS Code's bundled TypeScript TextMate grammar into test/grammars/ so the
// grammar tests can resolve the embedded `source.ts` include. The grammar ships
// with every VS Code install; we vendor a copy at test time rather than committing
// it. Regenerate by re-running `npm run fetch-ts-grammar`.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "test", "vendor", "TypeScript.tmLanguage.json");

const rel = "extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json";
const candidates = [
  // macOS
  `/Applications/Visual Studio Code.app/Contents/Resources/app/${rel}`,
  `/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/${rel}`,
  `${process.env.HOME}/Applications/Visual Studio Code.app/Contents/Resources/app/${rel}`,
  // Linux
  `/usr/share/code/resources/app/${rel}`,
  `/usr/lib/code/${rel}`,
  `/snap/code/current/usr/share/code/resources/app/${rel}`,
  // Windows
  `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Microsoft VS Code\\resources\\app\\${rel.replace(/\//g, "\\")}`,
];

const src = candidates.find((p) => p && existsSync(p));
if (!src) {
  console.error(
    "Could not locate VS Code's bundled TypeScript.tmLanguage.json.\n" +
      "Set it manually by copying it to:\n  " +
      dest +
      "\nSearched:\n" +
      candidates.map((c) => "  " + c).join("\n")
  );
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Vendored TS grammar:\n  from ${src}\n  to   ${dest}`);
