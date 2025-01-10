# How to patch a package

- First remove the `resolutions` field from package.json
- Then run `npx patch-package package-name` (note: must use npx instead of yarn) to generate the patch normally
- Finally revert the removal of `resolutions` field

