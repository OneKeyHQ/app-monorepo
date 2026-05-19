import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseUiautomatorXml, type UiNode } from "../src/tools/uiTree.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(
  path.join(here, "fixtures", "uiautomator_sample.xml"),
  "utf8",
);

describe("uiautomator parser", () => {
  it("parses root with children", () => {
    const root = parseUiautomatorXml(xml);
    expect(root.class).toBeTruthy();
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children.length).toBeGreaterThan(0);
  });

  it("converts bounds string to {x,y,w,h}", () => {
    const root = parseUiautomatorXml(xml);
    const find = (n: UiNode): UiNode | null => {
      if (n.bounds) return n;
      for (const c of n.children) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    };
    const n = find(root);
    expect(n).not.toBeNull();
    expect(n!.bounds).toMatchObject({
      x: expect.any(Number),
      w: expect.any(Number),
    });
  });

  it("finds the Send button by class match", () => {
    const root = parseUiautomatorXml(xml);
    const find = (
      n: UiNode,
      pred: (m: UiNode) => boolean,
    ): UiNode | null => {
      if (pred(n)) return n;
      for (const c of n.children) {
        const r = find(c, pred);
        if (r) return r;
      }
      return null;
    };
    const send = find(root, (m) => m.text === "Send");
    expect(send).not.toBeNull();
    expect(send!.clickable).toBe(true);
  });
});
