# LemmaScript VS Code Extension — Design

A VS Code extension that makes LemmaScript-annotated TypeScript pleasant to read
and lets you **view verification results** inline, on top of the normal
TypeScript editing experience.

It is the LemmaScript analogue of the Dafny VS Code extension — but where Dafny
ships a thick language server that *runs* verification as you type, this
extension is deliberately a **viewer**. Verification is performed out-of-band by
agents (or a human) running `lsc` / `dafny`; the extension renders the results
they produce.

> Companion document: [`LemmaScript/DESIGN_SOURCE_MAP.md`](../LemmaScript/DESIGN_SOURCE_MAP.md)
> defines the toolchain changes that produce the artifacts this extension
> consumes (the TS↔Dafny source map and the verification results file). The two
> can be built independently; their only coupling is the artifact schema in
> [§5](#5-verification-results-overlay).

---

## 1. Goals & non-goals

### Goals

1. **Highlight LemmaScript contracts.** `//@` annotation comments
   (`requires`, `ensures`, `invariant`, `decreases`, …) should stand out from
   ordinary comments and read like a first-class spec language — operators like
   `==>`, `forall`, `\result` colorized, expressions tokenized.
2. **View verification results.** Show, *on the `.ts` file*, what verified and
   what did not: per-function and per-contract status, error squiggles on the
   right source lines, a status-bar summary, and navigation into the generated
   Dafny for detail.
3. **Stay on top of TypeScript.** Don't replace or shadow the built-in
   TypeScript language features. IntelliSense, go-to-definition, type errors,
   formatting — all keep working unchanged. We *add* a layer; we don't fork one.

### Non-goals (at least for v1)

- **No language server.** We do not re-implement Dafny's live, incremental,
  as-you-type verification. Results are a snapshot produced by an external run.
- **No running verification from the editor.** The extension never invokes
  `lsc` or `dafny`. (A thin "re-run" convenience command is a possible later
  add — see [§9](#9-phasing), Phase 3 — but the core model is view-only.)
- **No counterexample/trace exploration** in v1 (Dafny's "verification trace"
  view). Possible later if the results artifact carries trace data.

---

## 2. Relationship to the TypeScript extension

LemmaScript files are *ordinary* `.ts` files. Annotations live in `//@ …` line
comments, which the built-in TypeScript grammar already tokenizes as
`comment.line.double-slash.ts`. We layer on top in two non-invasive ways:

- **Grammar injection** (not a new language). We contribute a TextMate grammar
  with `injectTo: ["source.ts", "source.tsx"]` and an `injectionSelector`
  scoped to `comment.line.double-slash`. It re-tokenizes the *inside* of `//@`
  comments and leaves everything else to the TS grammar. Files without `//@`
  comments are visually untouched.
- **Editor decorations / diagnostics** are attached to the existing `.ts`
  document by URI. They coexist with TS's own diagnostics.

Net effect: a LemmaScript file is a TypeScript file with extra paint and an
extra diagnostics source. Nothing about the TS experience regresses.

---

## 3. Architecture overview

Two mostly-independent subsystems:

```
┌─────────────────────────────────────────────────────────────┐
│ A. Contract highlighting        (self-contained, zero deps)  │
│    syntaxes/lemmascript.injection.json  +  language config   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ B. Results overlay              (consumes toolchain artifact) │
│                                                              │
│   <base>.lemma.json ──▶ ResultsModel ──▶ ┌ DiagnosticsView   │
│   (+ <base>.dfy.map)      (per .ts file)  ├ DecorationsView   │
│         ▲                                 ├ StatusBarView     │
│         │ produced by `lsc check`         ├ CodeLensProvider  │
│         │ (see DESIGN_SOURCE_MAP.md)      └ TreeView (opt)    │
└─────────────────────────────────────────────────────────────┘
```

Subsystem A has no runtime dependencies and can ship first. Subsystem B depends
on the artifact contract; until the toolchain produces it, B is dormant (and the
extension is still useful for highlighting).

---

## 4. Feature: contract syntax highlighting

### 4.1 Injection grammar

File: `syntaxes/lemmascript.injection.json`.

```jsonc
{
  "scopeName": "lemmascript.injection",
  "injectionSelector": "L:comment.line.double-slash",
  "patterns": [{ "include": "#lsc-annotation" }],
  "repository": { /* … */ }
}
```

`package.json` contribution:

```jsonc
"contributes": {
  "grammars": [{
    "scopeName": "lemmascript.injection",
    "path": "./syntaxes/lemmascript.injection.json",
    "injectTo": ["source.ts", "source.tsx", "source.js", "source.jsx"]
  }]
}
```

`L:` gives the injection priority over the host comment rule, so our tokens win
inside the comment.

### 4.2 What gets tokenized

The annotation grammar matches comments of the form `//@ <directive> <rest>`:

| Element | Example | Scope (suggested) |
|---|---|---|
| Annotation marker | `//@` | `punctuation.definition.annotation.lemmascript` |
| Directive keyword | `requires`, `ensures`, `invariant`, `decreases`, `type`, `verify`, `ghost`, `assert`, `assume`, `havoc`, `pure`, `extern`, `backend`, `declare-type`, `autohavoc`, `safe-slice`, `done_with`, `assert-shaped` | `keyword.control.lemmascript.<directive>` (one scope per directive, so each is themed independently — `assert-shaped` is matched before `assert` so the longer keyword wins) |
| Spec operators | `==>`, `<==>` | `keyword.operator.logical.lemmascript` |
| Quantifiers | `forall`, `exists` | `keyword.other.quantifier.lemmascript` |
| Result token | `\result` | `variable.language.result.lemmascript` |
| Expression body | the rest of the clause | `meta.embedded` → `source.ts` |

The expression body after the directive is tokenized **directly** by the
injection (numbers, strings, booleans, comparison/logic operators), *not* by
embedding `source.ts`. Embedding the full TypeScript grammar inside a line
comment was tried and rejected: it (a) leaks multi-line begin/end state (e.g.
`meta.arrow`) across consecutive `//@` lines, and (b) bypasses the
LemmaScript overlays (`\result`, `==>`, quantifiers) inside nested groups like
`(\result >= 0 && …)`, where `source.ts`'s own rules win and mangle the
backslash. Direct tokenization keeps the overlays uniform and self-contained
(it also means the grammar can be snapshot-tested without registering the TS
grammar for its own tokens). Plain identifiers retain the comment color, which
reads as "this is an annotation" while the spec vocabulary pops. (Verified by
`vscode-tmgrammar-snap` against VS Code's real TS grammar — see `test/`.)

> The directive keyword list must stay in sync with the parser. Source of truth:
> `LemmaScript/tools/src/specparser.ts` and `SPEC.md`. The list above is derived
> from current usage across `LemmaScript/examples`. A small test fixture
> (`test/fixtures/all-directives.ts`) should exercise every directive so drift
> is caught.

### 4.3 Theming

Non-directive tokens map to **standard** TextMate scopes (`keyword.operator`,
`variable.language`, `support.type`, …) so they get sensible colors under any
theme with no extra config. Directives, by contrast, each get a **dedicated
scope** (`keyword.control.lemmascript.<directive>`) and a **distinct default
color** shipped via `configurationDefaults` → `editor.tokenColorCustomizations`
→ `textMateRules` (one rule per directive, `foreground` + bold). Colors are
mid-tone so they read on both light and dark themes; users override any single
directive by adding a `textMateRules` entry for its scope. (A `textMateRules`
array in user settings replaces — does not merge with — the default, so this is
a documented caveat, not a per-directive toggle.)

### 4.4 Language configuration

A minimal `language-configuration` contribution is *not* needed for a new
language (we inject into TS). The only candidate addition is enabling
comment-continuation so that pressing Enter inside a `//@` block keeps the
`//@ ` prefix — a small editing nicety, implemented via an `onEnterRules`
contribution scoped narrowly. Optional; can be deferred.

---

## 5. Verification results overlay

### 5.1 Input contract (the artifact)

The extension is a pure consumer of two files written next to each `.ts`,
produced by the toolchain (see `DESIGN_SOURCE_MAP.md` for production):

- **`<base>.lemma.json`** — verification results, already mapped to TS
  coordinates. This is the primary input.
- **`<base>.dfy.map`** — TS↔Dafny line map. Optional for the extension; used
  only for "open the corresponding generated Dafny line" navigation.

Canonical schema lives in `DESIGN_SOURCE_MAP.md §6`. The shape the extension
relies on:

```jsonc
{
  "version": 1,
  "tsFile": "domain.ts",
  "generatedAt": "2026-06-14T18:03:00Z",
  "tool": { "lsc": "0.5.5", "dafny": "4.9.0", "backend": "dafny" },
  "status": "verified | failed | error",
  "summary": { "verified": 11, "failed": 1, "total": 12, "elapsedMs": 3400 },
  "decls": [
    { "name": "majority", "kind": "method", "ts": { "line": 24 },
      "status": "failed", "diagnostics": ["d0"] }
  ],
  "diagnostics": [
    { "id": "d0", "severity": "error",
      "message": "a postcondition could not be proved on this return path",
      "ts": { "line": 26, "col": 1 },              // null if unmapped
      "dfy": { "file": "domain.dfy", "line": 42, "col": 10 },
      "decl": "majority",
      "related": [ { "message": "this is the postcondition…",
                     "ts": { "line": 26 }, "dfy": { "line": 15 } } ] }
  ],
  "rawLog": "domain.dfy.log"
}
```

Designing the extension against *pre-mapped* results (the toolchain owns the
`.dfy → .ts` translation) keeps the viewer dumb and keeps all the mapping
intelligence in one place — the toolchain, which is where the source map lives.

### 5.2 Discovery & activation

- `activationEvents`: `onLanguage:typescript`, `onLanguage:typescriptreact`,
  and a `workspaceContains:**/*.lemma.json`.
- On activation, a `FileSystemWatcher` for `**/*.lemma.json` keeps a
  `Map<tsUri, ResultsModel>`. The `.ts` ↔ artifact relationship is by sibling
  basename (`domain.ts` ↔ `domain.lemma.json`) plus the artifact's own
  `tsFile` field as a cross-check.
- When an artifact is created/changed/deleted, recompute the affected `.ts`
  views. When a `.ts` editor opens, look up its model.

### 5.3 Staleness

The artifact is a snapshot. If the `.ts` was edited after `generatedAt` (or
after the artifact file's mtime), the results no longer describe the current
source. The extension computes staleness locally and renders stale results
**dimmed**, with a status-bar hint ("LemmaScript: results stale — re-run
verification"). This is important: it prevents a green checkmark from lying
after an edit. The toolchain cannot know this; the editor must.

### 5.4 Views

All views are read-only projections of `ResultsModel`.

1. **Diagnostics** (`vscode.languages.createDiagnosticCollection`). One entry
   per `diagnostics[*]` with a non-null `ts` position. Severity from `severity`.
   Message is the Dafny message. `relatedInformation` points at related TS
   locations and/or the generated Dafny location. Diagnostics with a null `ts`
   position (no source origin — e.g. a hand-added proof lemma in `.dfy`) are
   *not* dropped; they surface on the `.dfy` file instead (a secondary
   diagnostic collection keyed by the `.dfy` URI), so nothing is silently lost.

2. **Gutter decorations.** Per-declaration status icon in the gutter on the
   decl's `ts.line`: ✓ verified, ✗ failed, ⧖ stale/unknown. Mirrors Dafny's
   `verificationGutterStatusView` but driven by the artifact, not an LSP.

3. **Status bar** (`statusBarItem`). Active editor's file summary: `✓ 11/12` or
   `✗ 1 error` or `⧖ stale`. Click → "Show verification output" (opens
   `rawLog`).

4. **CodeLens** (read-only). Above each verified-able declaration: `✓ verified`
   / `✗ 1 error` / `⧖ stale`. The lens command opens the corresponding
   generated Dafny location (via `.dfy.map`) — *navigation only*, no run. This
   is the visual centerpiece that makes the file feel "Dafny-like."

5. **Hover.** Hovering a decl or a failing contract line shows the Dafny
   message(s), VC counts, and a "Open generated Dafny" link.

6. **Tree view** (optional, Phase 3). A "LemmaScript Verification" view in the
   Explorer/Test panel listing files → declarations → diagnostics, à la
   `verificationSymbolStatusView`.

### 5.5 Commands (viewer-only)

| Command | Action |
|---|---|
| `lemmascript.openGeneratedDafny` | Open `<base>.dfy` at the mapped line for the symbol/diagnostic under cursor |
| `lemmascript.showVerificationOutput` | Open the captured `rawLog` for the active file |
| `lemmascript.refreshResults` | Force re-read the artifact for the active file |
| `lemmascript.revealSourceMapEntry` | Debug aid: show the `.dfy.map` entry for the cursor position |

None of these run verification. (A `lemmascript.reverify` task-runner command is
explicitly deferred to Phase 3 and would be opt-in.)

---

## 6. Extension layout

```
lemmascript-vscode/
  package.json                      # contributes: grammars, commands, config, menus
  language-configuration.json       # optional (onEnterRules only)
  syntaxes/
    lemmascript.injection.json      # the injection grammar (Subsystem A)
  src/
    extension.ts                    # activate/deactivate, wiring
    results/
      artifact.ts                   # load + validate <base>.lemma.json / .dfy.map
      resultsModel.ts               # per-.ts in-memory model + staleness
      watcher.ts                    # FileSystemWatcher → model updates
    views/
      diagnostics.ts
      decorations.ts
      statusBar.ts
      codeLens.ts
      hover.ts
      tree.ts                       # Phase 3
    commands.ts
    config.ts
  test/
    fixtures/all-directives.ts      # grammar coverage fixture
    grammar.test.ts                 # snapshot tokenization
    results.test.ts                 # artifact parsing + staleness
  .vscode/                          # launch.json (F5 debug), tasks
  esbuild.js | webpack.config.js    # bundling
```

The cloned `ide-vscode/` (Dafny's extension) is reference material: its
`webpack.config.js`, `.vscode/launch.json`, test harness (`src/test/runTest.ts`)
and view structure (`src/ui/*`) are good templates. We do **not** depend on it or
fork it — LemmaScript's viewer is far smaller (no LSP client, no .NET tool
installer, no version management).

---

## 7. Configuration

| Setting | Default | Purpose |
|---|---|---|
| `lemmascript.highlight.accentContracts` | `true` | Apply the bundled contract accent colors |
| `lemmascript.results.enabled` | `true` | Enable the results overlay |
| `lemmascript.results.artifactGlob` | `**/*.lemma.json` | Where to find result artifacts |
| `lemmascript.results.showStale` | `true` | Show stale results dimmed vs. hide them |
| `lemmascript.codeLens.enabled` | `true` | Show per-decl status CodeLens |
| `lemmascript.diagnostics.onDfyForUnmapped` | `true` | Surface unmapped diagnostics on the `.dfy` |

---

## 8. Packaging & development

- **Bundling:** esbuild (lighter than the cloned Dafny extension's webpack
  setup; no need for its complexity).
- **Debug:** standard Extension Development Host (`F5`), `launch.json`.
- **Tests:** `@vscode/test-electron`; grammar snapshot tests via
  `vscode-tmgrammar-test` so directive tokenization is regression-guarded.
- **Publish:** `vsce package` / `vsce publish`. Marketplace metadata, icon,
  README with screenshots (mirror `ide-vscode/readmeResources` approach).
- **Engines:** target current VS Code stable; no native deps.

---

## 9. Phasing

**Phase 1 — Highlighting (no toolchain dependency).** Subsystem A only:
injection grammar, theming, optional `onEnterRules`, grammar tests. Ships
immediately; useful on its own; this is the part that's "ready to start now."

**Phase 2 — Results overlay.** Subsystem B against the artifact contract:
artifact loader + model + watcher, diagnostics, gutter decorations, status bar,
CodeLens, staleness. Requires the toolchain to emit `<base>.lemma.json` (and
optionally `.dfy.map`) per `DESIGN_SOURCE_MAP.md`. The two can be built in
parallel once the schema in §5.1 is frozen.

**Phase 3 — Niceties.** Tree view, hover detail, "open generated Dafny"
polish, optional `reverify` task command, and (if the artifact grows trace
data) a counterexample/trace view.

---

## 10. Open questions

1. **Artifact location.** Sibling files (`domain.lemma.json` next to
   `domain.ts`) vs. a `.lemmascript/` cache dir vs. a workspace-root manifest.
   Sibling is simplest and matches how `.dfy.gen`/`.dfy` already sit next to the
   `.ts`. Decision needed; affects discovery glob and `.gitignore`.
2. **Multiple `.ts` per artifact.** Today verification is per-file
   (`lsc check src/domain.ts`). If a project verifies many files, is there one
   artifact per `.ts` (assumed here) or a combined report? Per-file assumed.
3. **Whole-file vs. selective (`//@ verify`) mode.** In selective mode only some
   functions are verified; unmarked functions should render as "not verified"
   (neutral), not "stale/failed". The artifact should distinguish *not-attempted*
   from *failed* (the `decls[*].status` enum needs a `skipped`/`not-verified`
   value). Coordinate with the artifact schema.
4. **`.dfy` diagnostics file linkage.** When surfacing unmapped diagnostics on
   the `.dfy`, do we open/annotate `.dfy` or `.dfy.gen`? `.dfy` is the file
   Dafny actually verified, so: `.dfy`.
5. **Do we need `.dfy.map` in the extension at all,** or is the pre-mapped
   `.lemma.json` sufficient? It's sufficient for diagnostics; the map is only
   for "jump to generated Dafny." Could defer map consumption to Phase 3.
```
