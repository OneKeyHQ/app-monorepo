# How to patch a package

- First remove the `resolutions` field from package.json
- Then run `npx patch-package package-name` (note: must use npx instead of yarn) to generate the patch normally
- Finally revert the removal of `resolutions` field

## `@onekeyfe/*` packages

Patches to `@onekeyfe/*` packages (including npm aliases of them) may only change `.js`/`.jsx`/`.ts`/`.tsx` files. Native code (Objective-C, Swift, Java, Kotlin, C/C++) and native build files must be changed in [OneKeyHQ/app-modules](https://github.com/OneKeyHQ/app-modules) through a PR and a new release. `yarn lint:onekeyfe-patches` enforces this.
