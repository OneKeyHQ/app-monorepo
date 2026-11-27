# Protected CLI build process

This policy belongs to the original CLI esbuild source entry,
`apps/cli/scripts/build-lavamoat-runtime.cjs`. The official `@lavamoat/node`
1.0.7 loader evaluates that source and each JavaScript dependency in its own
package compartment. It does not evaluate a completed bundle as one trusted
module. The runner checks that esbuild appears as a protected policy resource
and rejects unexpected dependencies that the loader would otherwise treat as
implicit native modules.

```sh
node development/lavamoat/node-build-runtime.mjs --generate-policy
node development/lavamoat/node-build-runtime.mjs
node --test development/lavamoat/node-build-runtime.test.cjs
```

The repository requires Node >=22.12; use the tested Node 24 runtime for
this command. The CLI's existing exact source adapter also migrates the
legacy `safe-buffer` and `safer-buffer` constructor fallbacks to modern
`Buffer.from`, `Buffer.alloc`, and `Buffer.allocUnsafe` operations. It validates
the expected source text and leaves the installed packages unchanged. Policy generation writes only the generated policy. Review native,
filesystem, process, environment, and package grants before committing it;
place reviewed changes in `policy-override.json`. The optional `pnpapi`
discovery used by esbuild is accepted only when that module is absent in this
repository's `node-modules` installation. Any other implicit native exit fails
generation or execution.

The resulting normal esbuild artifact is written to
`apps/cli/dist-build-runtime/cli.js` and passes the existing deprecated Buffer
constructor check. This command protects the build process; it does not add
runtime protection to that artifact. Use the CLI workspace's `build:lavamoat`
for the separate package-aware runtime bundle in `dist-lavamoat`.

The current build-process policy covers this CLI esbuild invocation only.
Webpack, Metro, Jest, packaging, and release signing are separate build
processes and are not covered by this policy. Esbuild's executable and worker
threads, native modules, explicitly granted Node builtins, and first-party
build plugins remain trusted capability boundaries. In particular,
`child_process`, broad filesystem grants, or a supplied privileged callback
can confer authority beyond a JavaScript compartment. LavaMoat is not an OS
sandbox and does not confine esbuild's child executable.

The independent regression runs actual esbuild under the official loader,
checks frozen intrinsics, and demonstrates that an unrelated package cannot
read an existing synthetic file without its builtin permission. Full source
build and distribution validation are recorded separately from that fixture.
