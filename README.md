# LemmaScript for VS Code

Syntax highlighting for [LemmaScript](https://github.com/midspiral/LemmaScript)
contracts in TypeScript — the `//@` specification annotations
(`requires`, `ensures`, `invariant`, …) that LemmaScript compiles to Dafny for
formal verification.

This extension layers **on top of** the built-in TypeScript support. Your
`.ts` files stay ordinary TypeScript — IntelliSense, type-checking, and
formatting are untouched. We only add paint inside `//@` comments so contracts
read like a first-class spec language instead of grey prose.

```ts
//@ contract Returns a value occurring in more than half of arr, or -1 if none.
//@ requires forall(k: nat, k < arr.length ==> arr[k] >= 0)
//@ ensures \result === -1 || (\result >= 0 && 2 * occOf(arr, \result, arr.length) > arr.length)
export function majority(arr: number[]): number {
  //@ invariant 0 <= i && i <= arr.length
  //@ decreases arr.length - i
  ...
}
```

## What it highlights

Inside `//@` line comments (and only there — ordinary comments are left alone):

- **Directives** — `requires`, `ensures`, `invariant`, `decreases`, `type`,
  `verify`, `ghost`, `assert`, `assume`, `havoc`, `pure`, `extern`, `backend`,
  `declare-type`, `contract`, `autohavoc`, `safe-slice`, `done_with`,
  `assert-shaped`.
- **Spec operators** — implication `==>`, bi-implication `<==>`.
- **Quantifiers** — `forall`, `exists`.
- **The result keyword** — `\result`.
- **Spec types** — `nat`, `int`, `real`, … (e.g. `//@ type i nat`).
- Numbers, strings, booleans, and the usual comparison/logic operators.

Spec operators, quantifiers, `\result`, and literals use standard TextMate
scopes, so they pick up sensible colors from any theme. Directives are rendered
bold via the extension's `configurationDefaults`, with `requires` in amber
(`#C08A2E`), `ensures` in teal (`#1B8A6E`), `contract` (the natural-language
statement of intent) in pink-purple (`#AD3DA4`), and every other directive in
grey (`#808080`). The accents are mid-tones chosen to read on both light and
dark themes. Because each directive has its own scope, you can recolor any of
them individually.

To recolor a single directive, override its scope in your `settings.json`:

```jsonc
"editor.tokenColorCustomizations": {
  "textMateRules": [
    { "scope": "keyword.control.lemmascript.requires",
      "settings": { "foreground": "#1B8A6E", "fontStyle": "bold" } }
  ]
}
```

Every directive's scope is `keyword.control.lemmascript.<directive>` (e.g.
`keyword.control.lemmascript.ensures`, `….invariant`, `….done_with`). Confirm a
token's scope with **Developer: Inspect Editor Tokens and Scopes**.

> Note: a `textMateRules` array in your own settings *replaces* the extension's
> defaults rather than merging, so include any directives you still want colored.

## Status

This is **Phase 1** (highlighting). A later phase will add a *viewer* for
verification results — showing, on the `.ts`, what verified and what didn't —
driven by artifacts the LemmaScript toolchain produces. See
[`DESIGN.md`](DESIGN.md) for the full plan; the toolchain side lives in the
[LemmaScript repository](https://github.com/midspiral/LemmaScript). The
extension does **not** run verification itself.

## Development

```sh
npm install
npm run test:grammar        # snapshot-test the grammar against VS Code's TS grammar
npm run test:grammar:update # regenerate the snapshot after intentional changes
npm run package             # build a .vsix
```

Press `F5` in VS Code to launch an Extension Development Host and open a
LemmaScript `.ts` file (e.g. one from the
[LemmaScript examples](https://github.com/midspiral/LemmaScript/tree/main/examples))
to see the highlighting live.

The grammar tests vendor VS Code's bundled `TypeScript.tmLanguage.json` (via
`scripts/fetch-ts-grammar.mjs`) so the test harness can establish the comment
scopes our injection targets; the copy is git-ignored.

## License

MIT
