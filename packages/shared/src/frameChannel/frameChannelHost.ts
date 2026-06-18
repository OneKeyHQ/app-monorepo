/**
 * FrameChannelHost — domain-agnostic kernel for a bg→main frame channel.
 *
 * Orchestrates, per (owner, kind): a monotonic version (policy per kind), a
 * last-payload cache (PULL backstop), pull-only blobs, an MRU owner cap, and
 * owner create/evict lifecycle hooks. It is generic over a payload map and takes
 * an injected `emit`, so the kernel imports neither appEventBus nor any domain
 * type, and contains no domain vocabulary.
 *
 * Per-owner domain state (e.g. a diff `prev`) is stored by the consumer via
 * `setPullBlob` / `getPullBlob`, so it lives IN the owner slot and is evicted
 * atomically with the owner — there is no separate domain-keyed map that could
 * desync from the MRU, hence no create/evict lifecycle hooks are needed.
 *
 * Contracts (load-bearing — see design doc §4A):
 * - `pushFrame` MUST stay synchronous (no await / microtask): the bg runtime's
 *   nextTick queue can be dead, and callers emit fire-and-forget.
 * - `versionMode: 'domain'` requires the caller to supply `opts.version` (the
 *   version is a domain-computed value, e.g. a generation, not a counter).
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export type IFrameChannelVersionMode = 'increment' | 'domain';

export interface IFrameChannelKindConfig {
  /** The (static, consumer-registered) transport event name for this kind. */
  eventName: string;
  versionMode: IFrameChannelVersionMode;
}

export interface IFrameChannelHostOptions<
  TPayloads extends Record<string, unknown>,
> {
  /** Max concurrently-resident owners; LRU-evicted past this. */
  ownerCap: number;
  kinds: { [K in keyof TPayloads]: IFrameChannelKindConfig };
  /** Injected transport. Consumer wires the real bus emit here. */
  emit: (eventName: string, payload: unknown) => void;
}

export interface IFrameChannelFrame<P> {
  version: number;
  payload: P | undefined;
}

interface IOwnerSlot<TPayloads extends Record<string, unknown>> {
  versions: { [K in keyof TPayloads]: number };
  payloads: { [K in keyof TPayloads]: TPayloads[K] | undefined };
  pullBlobs: Map<string, unknown>;
}

export class FrameChannelHost<TPayloads extends Record<string, unknown>> {
  // Insertion-ordered Map used as an MRU: re-inserting on touch moves the key
  // to the tail; the head is the least-recently-used.
  private readonly owners = new Map<string, IOwnerSlot<TPayloads>>();

  private readonly kindKeys: (keyof TPayloads)[];

  constructor(private readonly options: IFrameChannelHostOptions<TPayloads>) {
    this.kindKeys = Object.keys(options.kinds) as (keyof TPayloads)[];
  }

  touchOwner(ownerKey: string): void {
    this.ensureOwner(ownerKey);
  }

  pushFrame<K extends keyof TPayloads>(
    kind: K,
    ownerKey: string,
    assemble: (version: number) => TPayloads[K],
    opts?: { version?: number },
  ): void {
    const cfg = this.options.kinds[kind];
    const slot = this.ensureOwner(ownerKey);

    let version: number;
    if (cfg.versionMode === 'domain') {
      if (opts?.version === undefined) {
        throw new OneKeyLocalError(
          `FrameChannel: kind "${String(
            kind,
          )}" is versionMode:'domain' and requires opts.version`,
        );
      }
      version = opts.version;
    } else {
      version = slot.versions[kind] + 1;
    }

    const payload = assemble(version);
    slot.versions[kind] = version;
    slot.payloads[kind] = payload;
    this.options.emit(cfg.eventName, payload);
  }

  setPullBlob(ownerKey: string, blobKey: string, blob: unknown): void {
    this.ensureOwner(ownerKey).pullBlobs.set(blobKey, blob);
  }

  getPullBlob<B>(ownerKey: string, blobKey: string): B | undefined {
    return this.owners.get(ownerKey)?.pullBlobs.get(blobKey) as B | undefined;
  }

  getFrames(ownerKey: string): {
    [K in keyof TPayloads]: IFrameChannelFrame<TPayloads[K]>;
  } {
    const slot = this.owners.get(ownerKey);
    const out = {} as {
      [K in keyof TPayloads]: IFrameChannelFrame<TPayloads[K]>;
    };
    for (const k of this.kindKeys) {
      out[k] = slot
        ? { version: slot.versions[k], payload: slot.payloads[k] }
        : { version: -1, payload: undefined };
    }
    return out;
  }

  private ensureOwner(ownerKey: string): IOwnerSlot<TPayloads> {
    const existing = this.owners.get(ownerKey);
    if (existing) {
      // MRU refresh: move to tail.
      this.owners.delete(ownerKey);
      this.owners.set(ownerKey, existing);
      return existing;
    }

    const versions = {} as { [K in keyof TPayloads]: number };
    const payloads = {} as { [K in keyof TPayloads]: TPayloads[K] | undefined };
    for (const k of this.kindKeys) {
      versions[k] = -1;
      payloads[k] = undefined;
    }
    const slot: IOwnerSlot<TPayloads> = {
      versions,
      payloads,
      pullBlobs: new Map(),
    };
    this.owners.set(ownerKey, slot);
    this.evictIfNeeded();
    return slot;
  }

  private evictIfNeeded(): void {
    while (this.owners.size > this.options.ownerCap) {
      const lruKey = this.owners.keys().next().value;
      if (lruKey === undefined) {
        break;
      }
      this.owners.delete(lruKey);
    }
  }
}
