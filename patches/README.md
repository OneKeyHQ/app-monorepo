# How to patch a package

- First remove the `resolutions` field from package.json
- Then run `npx patch-package package-name` (note: must use npx instead of yarn) to generate the patch normally
- Finally revert the removal of `resolutions` field

## `@onekeyfe/*` packages

Patches to `@onekeyfe/*` packages (including npm aliases of them) may only change `.js`/`.jsx`/`.ts`/`.tsx` files. `yarn lint:onekeyfe-patches` enforces this.

For native code (Objective-C, Swift, Java, Kotlin, C/C++) and native build files:

- **Debugging:** edit the files directly in `node_modules`, then rebuild the native shell with `yarn workspace @onekeyhq/mobile dev-shell --platform <android|ios> --shell local`. The default `--shell auto` does not notice edits inside `node_modules` and reuses a cached shell.
- **Submitting:** open a PR in [OneKeyHQ/app-modules](https://github.com/OneKeyHQ/app-modules), publish a new release, then upgrade the dependency here. Do not commit the native change as a patch.
- **Undoing without upgrading:** delete `apps/mobile/out-dir-bundle/dev-shell/local-cache/<platform>`, otherwise `--shell auto` keeps installing the local debug build.
