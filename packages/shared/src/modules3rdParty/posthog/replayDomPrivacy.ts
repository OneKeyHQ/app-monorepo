// cspell:ignore rrweb hrefs
// Privacy filters for the posthog-js (rrweb) replay instance on desktop.
//
// Pure functions over rrweb's serialized events, so they run without a DOM.
// Text nodes and input values are already masked by rrweb; these helpers
// cover what rrweb leaves readable: URLs and text-bearing attributes.

import type { CapturedNetworkRequest } from 'posthog-js';

export const REPLAY_URL_PARAM = ':param';

// rrweb EventType / IncrementalSource values (stable wire format).
const RRWEB_EVENT_FULL_SNAPSHOT = 2;
const RRWEB_EVENT_INCREMENTAL_SNAPSHOT = 3;
const RRWEB_EVENT_META = 4;
const RRWEB_SOURCE_MUTATION = 0;

// Route names and short ids such as `evm--1` stay readable; addresses,
// hashes, amounts and anything URL-encoded become REPLAY_URL_PARAM.
const MAX_SAFE_SEGMENT_LENGTH = 24;
const MAX_SAFE_SEGMENT_DIGITS = 4;
const SAFE_SEGMENT_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

// First segments of OS user / application-data paths on file:// URLs. A hot
// bundle is served from <userData>/onekey-bundle/<version>/build/index.html.
const OS_ROOT_SEGMENTS = new Set([
  'users',
  'home',
  'root',
  'volumes',
  'private',
  'var',
  'tmp',
  'opt',
  'mnt',
  'media',
  'library',
  'applications',
  'appdata',
  'programdata',
  'program files',
  'program files (x86)',
  'documents and settings',
]);
const DRIVE_LETTER_RE = /^[A-Za-z]:$/;
const HTML_FILE_RE = /\.html?$/i;
const FRAGMENT_ID_RE = /^#[A-Za-z_][\w:.-]{0,63}$/;

const MASKED_TEXT_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'aria-placeholder',
  'aria-roledescription',
  'title',
  'alt',
  'label',
  'placeholder',
  'value',
]);

type IRecord = Record<string, unknown>;

function isRecord(value: unknown): value is IRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

export function isSafeReplayRouteSegment(segment: string): boolean {
  if (
    !segment ||
    segment.length > MAX_SAFE_SEGMENT_LENGTH ||
    !SAFE_SEGMENT_RE.test(segment)
  ) {
    return false;
  }
  return segment.replace(/\D/g, '').length <= MAX_SAFE_SEGMENT_DIGITS;
}

function isOsRootSegment(segment: string): boolean {
  return (
    DRIVE_LETTER_RE.test(segment) || OS_ROOT_SEGMENTS.has(segment.toLowerCase())
  );
}

// Rewrites any URL to a route template: no origin, no file path, no query,
// no hash, and no dynamic segments. Never returns an empty string, because
// posthog-js drops the rrweb Meta event when the masked href is empty.
export function sanitizeReplayUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) {
    return '/';
  }
  let url: URL;
  try {
    url = new URL(rawUrl, 'file:///');
  } catch {
    return '/';
  }
  let segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeSegment(segment) ?? REPLAY_URL_PARAM);

  let htmlIndex = -1;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (HTML_FILE_RE.test(segments[i])) {
      htmlIndex = i;
      break;
    }
  }
  if (htmlIndex >= 0) {
    segments = segments.slice(htmlIndex + 1);
  } else if (
    url.protocol === 'file:' &&
    segments.length > 0 &&
    isOsRootSegment(segments[0])
  ) {
    return '/';
  }

  const template = segments.map((segment) =>
    isSafeReplayRouteSegment(segment) ? segment : REPLAY_URL_PARAM,
  );
  return `/${template.join('/')}`;
}

// Used for rrweb Meta / $url_changed hrefs (posthog-js passes `{ name }`) and
// for network entries if network capture is ever enabled server-side.
export function maskReplayNetworkRequest(
  request: CapturedNetworkRequest,
): CapturedNetworkRequest {
  return {
    ...request,
    name: sanitizeReplayUrl(request.name),
    requestHeaders: undefined,
    requestBody: undefined,
    responseHeaders: undefined,
    responseBody: undefined,
  };
}

export function maskReplayText(value: string): string {
  return value.replace(/\S/g, '*');
}

// Test ids are mostly static, but some embed addresses or names.
export function templateReplayTestId(value: string): string {
  return value
    .split('-')
    .map((part) =>
      part === '' || isSafeReplayRouteSegment(part) ? part : REPLAY_URL_PARAM,
    )
    .join('-');
}

export function scrubReplayAttributeValue(name: string, value: string): string {
  const key = name.toLowerCase();
  if (MASKED_TEXT_ATTRIBUTES.has(key)) {
    return maskReplayText(value);
  }
  if (key === 'href') {
    if (value.startsWith('#')) {
      // Keep in-document references (SVG <use>, anchors); drop hash routes.
      return FRAGMENT_ID_RE.test(value) ? value : '#';
    }
    return sanitizeReplayUrl(value);
  }
  if (key === 'data-testid') {
    return templateReplayTestId(value);
  }
  return value;
}

function scrubAttributes(attributes: IRecord): void {
  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    // null marks a removed attribute; objects are style diffs.
    if (typeof value === 'string') {
      attributes[key] = scrubReplayAttributeValue(key, value);
    }
  }
}

function scrubSerializedNode(root: unknown): void {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (isRecord(node)) {
      if (isRecord(node.attributes)) {
        scrubAttributes(node.attributes);
      }
      if (Array.isArray(node.childNodes)) {
        for (const child of node.childNodes) {
          stack.push(child);
        }
      }
    }
  }
}

// Mutates the event in place.
export function scrubReplayEvent(event: unknown): void {
  if (!isRecord(event) || !isRecord(event.data)) {
    return;
  }
  const { data } = event;
  if (event.type === RRWEB_EVENT_FULL_SNAPSHOT) {
    scrubSerializedNode(data.node);
    return;
  }
  if (event.type === RRWEB_EVENT_META) {
    if (typeof data.href === 'string') {
      data.href = sanitizeReplayUrl(data.href);
    }
    return;
  }
  if (
    event.type === RRWEB_EVENT_INCREMENTAL_SNAPSHOT &&
    data.source === RRWEB_SOURCE_MUTATION
  ) {
    if (Array.isArray(data.adds)) {
      for (const add of data.adds) {
        if (isRecord(add)) {
          scrubSerializedNode(add.node);
        }
      }
    }
    if (Array.isArray(data.attributes)) {
      for (const change of data.attributes) {
        if (isRecord(change) && isRecord(change.attributes)) {
          scrubAttributes(change.attributes);
        }
      }
    }
  }
}

// Time ranges in which the gate did not allow recording. rrweb stamps events
// with Date.now() when it emits them, so anything emitted inside a range was
// produced after the gate decided to pause (for example DOM mutations of a
// sensitive dialog that reach the MutationObserver before the queued stop).
export interface IReplayBlockWindows {
  open(at: number): void;
  close(at: number): void;
  isBlocked(timestamp: number): boolean;
}

export function createReplayBlockWindows({
  maxClosedWindows = 64,
}: { maxClosedWindows?: number } = {}): IReplayBlockWindows {
  let openSince: number | undefined;
  const closed: { from: number; to: number }[] = [];
  return {
    open(at) {
      if (openSince === undefined) {
        openSince = at;
      }
    },
    close(at) {
      if (openSince === undefined) {
        return;
      }
      closed.push({ from: openSince, to: at });
      openSince = undefined;
      if (closed.length > maxClosedWindows) {
        closed.shift();
      }
    },
    isBlocked(timestamp) {
      if (openSince !== undefined && timestamp >= openSince) {
        return true;
      }
      return closed.some(({ from, to }) => timestamp >= from && timestamp < to);
    },
  };
}

// Returns the events that may leave the device, scrubbed in place. Fails
// closed: events without a timestamp, or compressed by posthog-js (which
// would hide them from the scrubber), are dropped.
export function filterReplaySnapshotData(
  events: readonly unknown[],
  blockWindows: IReplayBlockWindows,
): unknown[] {
  const kept: unknown[] = [];
  for (const event of events) {
    if (
      isRecord(event) &&
      !('cv' in event) &&
      typeof event.timestamp === 'number' &&
      !blockWindows.isBlocked(event.timestamp)
    ) {
      scrubReplayEvent(event);
      kept.push(event);
    }
  }
  return kept;
}
