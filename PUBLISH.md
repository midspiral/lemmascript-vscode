# Publishing the LemmaScript VS Code extension

Everything needed to ship this extension so people can install it with one click.
The account/token steps must be done by a human once; after that, publishing is
a couple of commands.

Identity used below:

- **Publisher:** `midspiral`
- **Extension name:** `lemmascript-vscode`
- **Extension ID:** `midspiral.lemmascript-vscode`
- **Marketplace URL (once live):** https://marketplace.visualstudio.com/items?itemName=midspiral.lemmascript-vscode

We publish to **two** registries:

| Registry | Reaches | Tool |
|---|---|---|
| **VS Code Marketplace** | Microsoft VS Code | `@vscode/vsce` (already a devDependency) |
| **Open VSX** | VS Code *forks* — Cursor, VSCodium, Gitpod, Theia, Windsurf | `ovsx` (`npx ovsx`) |

Publishing to both is recommended: many LemmaScript users are on Cursor, which
can only install from Open VSX.

---

## 1. One-time setup

### 1a. VS Code Marketplace

The Marketplace is backed by Azure DevOps, so the token comes from there.

1. **Create an Azure DevOps organization** (if you don't have one):
   https://dev.azure.com — sign in with a Microsoft account, create any org.
2. **Create a Personal Access Token (PAT):**
   - Azure DevOps → top-right user icon → **Personal Access Tokens** → **New Token**.
   - **Organization:** select **All accessible organizations** (critical — a
     single-org token fails to publish).
   - **Scopes:** **Custom defined** → expand **Marketplace** → check **Manage**.
   - **Expiration:** set as long as allowed; PATs expire and will need rotating.
   - Copy the token now (it's shown once).
3. **Create the publisher** `midspiral`:
   https://marketplace.visualstudio.com/manage/createpublisher
   - The **ID** must be exactly `midspiral` (it must match the `publisher`
     field in `package.json`).
4. **Log in locally:**
   ```sh
   npx vsce login midspiral
   # paste the PAT when prompted
   ```

> The PAT is what `vsce` uses to authenticate. Store it in a password manager;
> you'll need it again for CI and for `vsce login` after it expires.

### 1b. Open VSX

1. **Sign in** at https://open-vsx.org with GitHub.
2. **Sign the Eclipse Publisher Agreement:** open-vsx.org → your avatar →
   **Settings** → there's a prompt to log in to the Eclipse Foundation and sign
   the **Publisher Agreement** (a.k.a. Eclipse Contributor Agreement). Required
   before you can publish.
3. **Create an access token:** open-vsx.org → Settings → **Access Tokens** →
   generate one. Copy it.
4. **Create the namespace** (must match the publisher):
   ```sh
   npx ovsx create-namespace midspiral -p <OPEN_VSX_TOKEN>
   ```

---

## 2. Pre-publish checklist

Before the first publish, finish the listing. These improve the Marketplace page
but most are not strictly required to publish.

- [ ] **Icon.** Add a 128×128 (256×256 recommended) PNG at `images/icon.png` and
      reference it in `package.json`:
      ```jsonc
      "icon": "images/icon.png"
      ```
      Without it the listing shows a generic placeholder. (Note: `images/` is
      currently covered by nothing in `.vscodeignore`, so it will be packaged —
      good. Keep the icon small.)
- [ ] **Screenshots in the README.** The `README.md` *is* the Marketplace
      detail page. Add a screenshot of highlighted contracts (light + dark).
      For images to render on the Marketplace, either use **absolute URLs**
      (e.g. raw.githubusercontent.com links) or rely on `vsce`'s relative-path
      rewriting, which uses the `repository` field — make sure `repository` is
      correct (it is). When in doubt, pass
      `--baseContentUrl`/`--baseImagesUrl` to `vsce package`.
- [ ] **Listing metadata in `package.json`** (recommended additions):
      ```jsonc
      "homepage": "https://github.com/midspiral/lemmascript-vscode#readme",
      "bugs": { "url": "https://github.com/midspiral/lemmascript-vscode/issues" },
      "galleryBanner": { "color": "#1B2A26", "theme": "dark" }
      ```
- [ ] **`preview` flag.** `package.json` has `"preview": true`, which shows a
      "Preview" badge. Keep it for early releases; remove it when you consider
      the extension stable.
- [ ] **Version.** Confirm `version` in `package.json` (currently `0.1.0`).
      Marketplace rejects re-publishing the same version — bump for every
      publish (see §4).
- [ ] **`ovsx` available.** It's used via `npx`; optionally add it as a
      devDependency for reproducibility:
      ```sh
      npm i -D ovsx
      ```
- [ ] **LICENSE present** (it is — MIT).
- [ ] **`.vscodeignore` excludes dev files** (it does: tests, scripts, docs).

---

## 3. Publish

### 3a. Build and smoke-test the package first

```sh
npm run test:grammar          # grammar snapshot must pass
npm run package               # produces lemmascript-vscode-<version>.vsix
code --install-extension lemmascript-vscode-*.vsix   # try it in real VS Code
```
Open a LemmaScript `.ts` (e.g. from `LemmaScript/examples`) and confirm the
highlighting. Then `code --uninstall-extension midspiral.lemmascript-vscode` if
you want a clean state.

### 3b. VS Code Marketplace

```sh
# after `vsce login midspiral` (§1a), simplest:
npx vsce publish

# …or bump version and publish in one step:
npx vsce publish patch        # 0.1.0 -> 0.1.1   (also: minor, major)

# …or publish a prebuilt vsix with a one-off token (good for CI):
npx vsce publish --packagePath lemmascript-vscode-0.1.0.vsix -p <PAT>
```
Live within a minute or two at the Marketplace URL above.

### 3c. Open VSX

```sh
# publish the same vsix:
npx ovsx publish lemmascript-vscode-0.1.0.vsix -p <OPEN_VSX_TOKEN>

# …or let ovsx package + publish from source:
npx ovsx publish -p <OPEN_VSX_TOKEN>
```

---

## 4. Versioning & updates

- Semantic versioning. `vsce publish patch|minor|major` bumps `package.json`,
  and (in a git repo) creates a commit + tag — push them afterwards.
- Every publish needs a **new** version; re-publishing an existing version is
  rejected on both registries.
- Update `CHANGELOG.md` for each release (it shows on the Marketplace page).
- Republish to **both** registries each time (they don't sync).

---

## 5. Recommend it from LemmaScript projects

So that anyone opening a LemmaScript repo gets nudged to install it, add this to
that project's `.vscode/extensions.json`:

```json
{
  "recommendations": ["midspiral.lemmascript-vscode"]
}
```

VS Code (and Cursor) then shows a "this workspace recommends…" prompt. Good
candidates: the LemmaScript repo itself and the example/case-study repos.

---

## 6. Optional: publish from CI (GitHub Actions)

Automate releases on tag push. Store `VSCE_PAT` and `OVSX_PAT` as repository
secrets (Settings → Secrets and variables → Actions).

```yaml
# .github/workflows/publish.yml
name: Publish extension
on:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test:grammar
      - run: npx vsce publish -p ${{ secrets.VSCE_PAT }}
      - run: npx ovsx publish -p ${{ secrets.OVSX_PAT }}
```
Release flow then becomes: bump version, `git tag vX.Y.Z`, `git push --tags`.

---

## 7. Gotchas

- **`vsce` PAT scope.** The #1 failure is a PAT scoped to a single org instead
  of "All accessible organizations," or missing the **Marketplace → Manage**
  scope. Symptom: 401/403 on publish.
- **Publisher mismatch.** `package.json`'s `publisher` must equal the created
  publisher ID (`midspiral`) and the Open VSX namespace.
- **README images don't show on the Marketplace.** Use absolute raw URLs, or
  verify `repository` is set so `vsce` can rewrite relative paths.
- **Re-publishing same version fails.** Always bump.
- **`engines.vscode`** (`^1.84.0`) gates which VS Code versions can install it;
  raise the floor only when you start using newer APIs.
- **No `main`/activation events is fine.** This is a declarative
  (grammar-only) extension; `vsce` will not complain about a missing entry point.

---

## 8. Cheat sheet

```sh
# one-time
npx vsce login midspiral
npx ovsx create-namespace midspiral -p <OPEN_VSX_TOKEN>

# each release
# 1. update CHANGELOG.md
npm run test:grammar
npx vsce publish patch                                   # Marketplace (+ bump+tag)
git push && git push --tags
npx ovsx publish "$(ls -t *.vsix | head -1)" -p <OPEN_VSX_TOKEN>   # Open VSX
```
