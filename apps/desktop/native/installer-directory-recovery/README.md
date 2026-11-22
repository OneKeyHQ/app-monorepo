# Windows installer directory recovery

The NSIS installer and uninstaller use this helper to replace and remove an enrolled OneKey installation at the default path on a fixed NTFS volume. The user and machine scopes select separate registration and journal keys. The machine scope uses the native Program Files directory and the 64-bit HKLM registry.

## Signed inventories

The Windows build creates `OneKeyInstallerDirectoryRecovery.exe` and an unsigned PE template. During signed NSIS packaging, electron-builder signs the app payload and generates and signs the uninstaller. It then builds and signs a `OneKeyInstallerInventory.dll` variant for each packaged architecture. Each inventory includes the release, SHA-256 digests for every installed file, and every directory. It includes the final, signed uninstaller and the uninstall icon when present.

The carrier has no entry point. The helper reads the inventory from an Authenticode-covered data section and checks the Windows trust result and the SHA-256 pin of the signing leaf. It also checks the full-file digest of the carrier distributed inside the install directory. A signed inventory binds all files that can move with an installation, including the carrier itself through this separate digest check. The preflight command is `verify-inventory <release> <carrier-path>`.

Production builds pin `apps/desktop/resources/windows/code-signing/onekey-limited.cer`. The current certificate expires on September 17, 2027. Preserve approved pins when rotating signing certificates so that signed, timestamped installations can still authenticate their original inventory. Pass the older approved leaf files with `build.ps1 -PublisherCertificate <paths>` during the rotation. The active certificate stays in the checked-in signing path. Recovery uses Windows' local trust cache and can run offline once the signing chain is trusted. Missing or untrusted certificates block enrollment and recovery until Windows can validate the chain. [Windows trust verification](https://learn.microsoft.com/en-us/windows/win32/api/wintrust/ns-wintrust-wintrust_data)

After successful registration of a fresh or legacy installation, `enroll` verifies the complete installed tree and records the enrollment in the selected scope. Later upgrades and uninstalls read the original signed inventory from that tree. A missing or changed inventory blocks either operation for an enrolled installation.

## Installer interface

Commands take `--scope user|machine`, `--target <absolute registered path>`, `--release <DisplayVersion>` and `--owner-pid <installer process ID>`. Pass `--new-inventory <extracted signed carrier>` for enrollment, replacement and published recovery. The helper locates the original inventory itself, including during rollback from the backup.

| Result | Meaning |
| --- | --- |
| 0 | The requested operation succeeded. |
| 10 | The selected install is ineligible for replacement, or the queried transaction is absent. |
| 11 | The previous release is back at its registered path after an interrupted replacement. |
| 12 | The new directory is published. The matching installer must finish registration and commit. |
| 13 | The operation is blocked. Retain the journal and directories for recovery or diagnosis. |
| 14 | An enrolled uninstall committed its directory rename. Setup receives the tombstone token and runs the verified uninstaller to finish teardown. |
| 16 | Setup could not verify a local fixed installation volume or directory. |
| 17 | The unregistered default installation directory contains files. Setup leaves those files intact. |

1. Call `recover` before invoking the old uninstaller. A pending transaction owns the replacement flow. After the cancellable setup work finishes, `check-process-target` verifies the registered directory for the selected scope and checks both scope registrations for overlap. It also supports verified legacy custom paths. Result 0 authorizes closing the matching app and running the existing legacy uninstaller if legacy replacement is required. Result 10 permits a fresh install when the target is unowned. Result 14 directs Setup to finish removal and exit. Any other result blocks the install.
2. Call `prepare` for an eligible upgrade. It verifies the scope, registration and complete original tree, then records the transaction and creates the sibling staging directory. `prepare` prints a 32-character ASCII token. Extract the signed payload, signed uninstaller, uninstall icon when configured, and carrier into `<target>.new-<token>`.
3. Release installer file handles and call `promote`. It rechecks the original and staged inventories, moves the original directory to `<target>.old-<token>`, and publishes the staged directory at the registered path. If publication fails, it attempts to restore the original directory.
4. After publication or result 12, write and check registration, shortcuts and app integrations. Call `commit` once these succeed. It checks the selected scope, registered path, uninstaller commands, release, directory identity and complete installed inventory before clearing the transaction. It then tries to dispose of the verified backup. Launch is allowed after commit.

Windows directory IDs determine which rename completed during an interruption. Before publication, the helper can restore the previous directory and dispose of the staged files it can verify. After publication, it requires the matching installer to finish registration because the new application may already have migrated data. A single durable cleanup slot per scope tracks a backup, uninstall tombstone or recorded staging directory by identity. The helper retries pending disposal before admitting another transaction that needs the slot. A failed or interrupted cleanup leaves its record available for retry.

A signed installation at the default path verifies the incoming inventory before allowing the legacy installer flow, then enrolls after checking the installed files and registration. Embedded 7z packages are extracted and checked before legacy removal in silent, standard NSIS and Win32 UI flows. Web, ZIP and unpacked directory builds use their corresponding builder paths. Legacy replacement can still fail during removal, final copy or registration, after the successful pre-extraction. An older release without an inventory gets directory recovery from its next eligible upgrade. Unenrolled installations on accessible fixed local volumes, including ReFS and fixed exFAT volumes, can use the legacy flow. Setup stops when a selected or registered path cannot be verified, including network and removable volumes, offline drives, and directories under junctions or other reparse points. Setup requires a new default installation directory to be absent or empty. An enrolled installation requires its original registered path and can be repaired or switched to a different installer variant at the same version.

## Enrolled uninstall

`uninstall-prepare` validates the registered path, uninstaller and complete signed inventory. It saves a durable intent before renaming the entire directory to `<target>.uninstall-<token>`, then verifies the detached tree and commits the rename. If interrupted before commit, Setup or the uninstaller can restore the complete tree and exact registered uninstaller. The uninstaller removes registrations, shortcuts and integrations after commit. An explicitly requested app-data deletion remains part of the original uninstall run.

If Setup receives result 14, it copies the uninstaller from the detached tree into its private temporary directory. `verify-uninstall-worker` checks the copied bytes against the signed inventory while Setup holds the directory and executable in place. The worker runs with the original target and the returned 32-character token. `uninstall-prepare --token <token>` resumes the matching committed transaction, then `uninstall-finish` verifies registration removal, transfers the detached tree to pending cleanup and clears enrollment. Cleanup can be retried without rerunning the uninstaller. Resumed removal preserves app data. Interactive Setup confirms that removal finished and asks the user to run Setup again. Plain `/S` returns 0 after recovery-only completion. `/S --updated` returns process exit code 15 with or without `--force-run`. Both silent routes complete removal and exit without installing or launching the app. A launcher that waits for Setup can observe code 15.

## Build and test

From PowerShell at the repository root, use MSVC and the Windows SDK.

```powershell
$source = 'apps/desktop/native/installer-directory-recovery'
$output = 'apps/desktop/build/installer-generated/recovery-test'
& "$source/build.ps1" -OutputDirectory $output -TestBuild
& "$source/test.ps1" -Helper "$output/OneKeyInstallerDirectoryRecovery.exe" -SignedInventories
```

The tests use isolated HKCU keys and temporary fixture directories. The signed fixtures compile the production inventory parser and verifier with a disposable publisher certificate. They cover signature tampering, wrong release and publisher, absent enrollment across scopes, and interruptions on both sides of publication. Fixture certificates live in the current user's personal certificate store for signing and are deleted after the test. Production release qualification uses the signed installer artifacts and real UAC install scopes.
