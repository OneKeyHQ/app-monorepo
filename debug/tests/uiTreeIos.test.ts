import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRecursiveDescription,
  type IosNode,
} from "../src/tools/uiTreeIos.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(
  path.join(here, "fixtures", "lldb_recursive_description.txt"),
  "utf8",
);

// Strip the start/end markers the way the runtime parser does.
function sliced(s: string): string {
  const a = s.indexOf("##ODB_START##");
  const b = s.indexOf("##ODB_END##");
  return s.slice(a + "##ODB_START##".length, b);
}

describe("lldb recursiveDescription parser", () => {
  it("parses root class as UIWindow", () => {
    const root = parseRecursiveDescription(sliced(raw));
    expect(root.class).toBe("UIWindow");
    expect(root.address.startsWith("0x")).toBe(true);
  });

  it("nests at least 5 levels", () => {
    const root = parseRecursiveDescription(sliced(raw));
    const depth = (n: IosNode, d = 0): number =>
      n.children.length === 0
        ? d
        : Math.max(...n.children.map((c) => depth(c, d + 1)));
    expect(depth(root)).toBeGreaterThanOrEqual(5);
  });

  it("captures frame attribute", () => {
    const root = parseRecursiveDescription(sliced(raw));
    expect(root.attrs.frame).toContain("0 0");
  });
});
