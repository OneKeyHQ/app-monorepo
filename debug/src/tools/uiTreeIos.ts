import { execa } from "execa";
import type { Session } from "../daemon/session.js";

const LINE_RE =
  /^(?<indent>(?:\s+\|)*)\s*<(?<cls>[A-Za-z_]\w*): (?<addr>0x[0-9a-f]+);\s*(?<rest>.*)>$/;

export interface IosNode {
  class: string;
  address: string;
  attrs: Record<string, string>;
  children: IosNode[];
}

function parseAttrs(rest: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of rest.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

export function parseRecursiveDescription(text: string): IosNode {
  const lines = text
    .split("\n")
    .filter((ln) => ln.includes("<") && ln.includes("0x"));
  const stack: Array<[number, IosNode]> = [];
  let root: IosNode | null = null;

  for (const ln of lines) {
    const m = LINE_RE.exec(ln);
    if (!m || !m.groups) continue;
    const depth = (m.groups.indent.match(/\|/g) ?? []).length;
    const node: IosNode = {
      class: m.groups.cls,
      address: m.groups.addr,
      attrs: parseAttrs(m.groups.rest),
      children: [],
    };
    while (stack.length && stack[stack.length - 1][0] >= depth) stack.pop();
    if (stack.length) stack[stack.length - 1][1].children.push(node);
    else root = node;
    stack.push([depth, node]);
  }
  return root ?? { class: "<empty>", address: "0x0", attrs: {}, children: [] };
}

export async function uiTreeIos(session: Session): Promise<IosNode> {
  const r = await execa(
    "lldb",
    [
      "--batch",
      "-o",
      "process attach --name OneKey",
      "-o",
      `expression -l objc -- (void)NSLog(@"##ODB_START##%@##ODB_END##", ` +
        `[[[UIApplication sharedApplication] keyWindow] recursiveDescription])`,
      "-o",
      "process detach",
    ],
    { timeout: 20_000, reject: false },
  );
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const s = text.indexOf("##ODB_START##");
  const e = text.indexOf("##ODB_END##");
  if (s < 0 || e < 0) {
    throw new Error(
      `lldb output missing markers (session ${session.id}). lldb may not be attached; ensure the iOS sim is running OneKey.`,
    );
  }
  return parseRecursiveDescription(text.slice(s + "##ODB_START##".length, e));
}
