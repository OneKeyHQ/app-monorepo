import { execa } from "execa";

export class Adb {
  constructor(public readonly serial: string) {}

  /**
   * Run `adb -s <serial> exec-out <args...>` and return stdout as Buffer.
   * `exec-out` strips trailing CR/LF protocol artifacts that plain `adb shell` adds —
   * critical for raw PNG bytes from `screencap -p`.
   */
  async execOut(
    args: string[],
    opts: { timeout?: number } = {},
  ): Promise<Buffer> {
    const r = await execa("adb", ["-s", this.serial, "exec-out", ...args], {
      encoding: "buffer",
      timeout: opts.timeout ?? 30_000,
    });
    return r.stdout as Buffer;
  }

  async shell(
    args: string[],
    opts: { timeout?: number } = {},
  ): Promise<string> {
    const r = await execa("adb", ["-s", this.serial, "shell", ...args], {
      timeout: opts.timeout ?? 30_000,
    });
    return r.stdout;
  }
}
