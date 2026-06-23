---
name: 1k-patch-package-workflow
description: Create or regenerate a patch-package patch in this monorepo. Use when you edit anything under node_modules/ and need a persisted .patch, or when `npx patch-package <pkg>` fails with "Couldn't find any versions for ... matches ^x@x". Keywords: patch-package, patch a package, regenerate patch, resolutions error.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# patch-package workflow

Patches live in `patches/<pkg>+<version>.patch` and auto-apply on install. Never hand-edit a `.patch` — edit the `node_modules/` source, then generate.

## Generate

1. Edit `node_modules/<pkg>/...`. Comment lines out (don't delete) with a `// OneKey patch: <why>` note above.
2. Generate — **must drop `resolutions` first** or it fails with `Couldn't find any versions for ...`:

```bash
cp package.json /tmp/pkg.bak
node -e "const fs=require('fs');const p=require('./package.json');delete p.resolutions;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
npx patch-package <pkg>          # npx, not yarn
cp /tmp/pkg.bak package.json     # restore byte-exact
```

## Fallback (generate still fails: offline / private dep)

Diff the edited file against the pristine tarball in the Yarn cache:

```bash
EXTRACT=$(mktemp -d); unzip -q .yarn/cache/<pkg>-npm-<ver>-*.zip -d "$EXTRACT"
PRISTINE=$(find "$EXTRACT" -path "*<rel/path/File.ext>"); SUB="node_modules/<pkg>/<rel/path/File.ext>"
REPO=$(mktemp -d); (cd "$REPO" && git init -q && mkdir -p "$(dirname "$SUB")" \
  && cp "$PRISTINE" "$SUB" && git add -A && git -c user.email=x -c user.name=x commit -qm base \
  && cp "$OLDPWD/$SUB" "$SUB" && git diff) > patches/<pkg>+<version>.patch
```

## Verify (required)

```bash
git apply --check -p1 patches/<pkg>+<version>.patch   # must pass against a pristine file
grep -c android/build patches/<pkg>+<version>.patch   # must be 0 (else rm -rf node_modules/<pkg>/android/build, regenerate)
```
