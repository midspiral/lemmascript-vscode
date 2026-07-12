# Changelog

## 0.1.2

- Escaped quotes in spec strings (e.g. `\"`) tokenize correctly instead of leaking the string highlight to the rest of the line.

## 0.1.1

- Self-contained docs.

## 0.1.0

Phase 1 — contract syntax highlighting.

- TextMate **injection grammar** that highlights LemmaScript `//@` contract
  annotations inside TypeScript / JavaScript line comments, layered on top of
  the built-in TypeScript support (no language replacement).
- Highlights directives, the implication/bi-implication operators, quantifiers,
  `\result`, spec types, and literals. Ordinary comments and unrecognized
  directives are left untouched.
- Directive keywords and the `@` marker rendered bold by default via
  `configurationDefaults`.
- Snapshot-based grammar tests (`vscode-tmgrammar-snap`) wired to VS Code's real
  TypeScript grammar.
