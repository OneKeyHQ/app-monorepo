import { XMLParser } from "fast-xml-parser";
import { Adb } from "../adapters/androidNative.js";
import type { Registry } from "../daemon/registry.js";
import type { IosNode } from "./uiTreeIos.js";

const BOUNDS_RE = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/;

export interface UiNode {
  class: string;
  resourceId?: string;
  contentDesc?: string;
  text?: string;
  bounds?: { x: number; y: number; w: number; h: number };
  clickable: boolean;
  children: UiNode[];
}

/**
 * fast-xml-parser with `preserveOrder: true` emits each XML element as an
 * object containing exactly one tag-name key (whose value is an array of
 * child elements) plus an optional `:@` sibling holding that element's
 * own attributes. Example for an element with one nested child:
 *   { node: [ <nested-child-elements> ], ":@": { "@_attr": "v" } }
 */
type RawAttrs = Record<string, string | undefined>;
interface RawElement {
  ":@"?: RawAttrs;
  [tagName: string]: RawElement[] | RawAttrs | undefined;
}

function getAttrs(el: RawElement): RawAttrs {
  return el[":@"] ?? {};
}

/**
 * Return the tag name and children-array for an element wrapper.
 * Skips the reserved `:@` attrs key.
 */
function getTag(
  el: RawElement,
): { name: string; children: RawElement[] } | undefined {
  for (const key of Object.keys(el)) {
    if (key === ":@") continue;
    const value = el[key];
    if (Array.isArray(value)) {
      return { name: key, children: value as RawElement[] };
    }
  }
  return undefined;
}

function parseBounds(s: string | undefined): UiNode["bounds"] {
  if (!s) return undefined;
  const m = BOUNDS_RE.exec(s);
  if (!m) return undefined;
  const x1 = Number(m[1]);
  const y1 = Number(m[2]);
  const x2 = Number(m[3]);
  const y2 = Number(m[4]);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function nodeFromElement(el: RawElement): UiNode {
  const attrs = getAttrs(el);
  const tag = getTag(el);
  const childElements = tag?.children ?? [];
  return {
    class: attrs["@_class"] ?? tag?.name ?? "",
    resourceId: attrs["@_resource-id"] || undefined,
    contentDesc: attrs["@_content-desc"] || undefined,
    text: attrs["@_text"] || undefined,
    bounds: parseBounds(attrs["@_bounds"]),
    clickable: attrs["@_clickable"] === "true",
    children: childElements.map(nodeFromElement),
  };
}

export function parseUiautomatorXml(xml: string): UiNode {
  const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml) as RawElement[];

  // The top-level array contains `?xml` plus the document root. Find <hierarchy>.
  const hierarchyEl = parsed.find((el) => {
    const tag = getTag(el);
    return tag?.name === "hierarchy";
  });
  if (!hierarchyEl) {
    throw new Error("no <hierarchy> root in uiautomator XML");
  }
  const hierarchyTag = getTag(hierarchyEl);
  const topNodes = hierarchyTag?.children ?? [];

  if (topNodes.length === 1) {
    return nodeFromElement(topNodes[0]);
  }
  return {
    class: "<hierarchy>",
    clickable: false,
    children: topNodes.map(nodeFromElement),
  };
}

export async function uiTreeAndroid(adb: Adb): Promise<UiNode> {
  const raw = await adb.execOut(["uiautomator", "dump", "/dev/tty"]);
  let text = raw.toString("utf8");
  const end = text.lastIndexOf("</hierarchy>");
  if (end >= 0) text = text.slice(0, end + "</hierarchy>".length);
  return parseUiautomatorXml(text);
}

export async function uiTree(
  registry: Registry,
  params: { sessionId: string },
): Promise<UiNode | IosNode> {
  const s = registry.get(params.sessionId);
  if (s.platform === "android") return uiTreeAndroid(new Adb(s.deviceId));
  if (s.platform === "ios") {
    const m = await import("./uiTreeIos.js");
    return m.uiTreeIos(s);
  }
  throw new Error(`unsupported platform: ${s.platform as string}`);
}
