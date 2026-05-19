import { execa } from "execa";

export class SimCtl {
  constructor(public readonly udid: string = "booted") {}

  /** Saves screenshot of the booted simulator to `outPath`. */
  async screenshot(outPath: string): Promise<void> {
    await execa("xcrun", ["simctl", "io", this.udid, "screenshot", outPath], {
      timeout: 15_000,
    });
  }
}
