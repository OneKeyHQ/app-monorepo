import { BlockIdentifier } from "starknet";
import {
  SetupRequirement,
  StarknetAddressBigint,
  type Blob,
  type ChannelSerde,
  type StarknetAddress,
  type WitnessSerde,
} from "../interfaces";
import { AddressMap } from "../utils/maps";
import { jsonStringify, jsonParse } from "../utils/json";
import { PublicKey } from "../utils/crypto";

/**
 * Tracks nonces for a token subchannel within a channel.
 * - tokenIndex: identifies which subchannel (fixed, part of the ID)
 * - noteNonce: next note index to use (advances as notes are created)
 */
export type TokenChannel = {
  tokenIndex: number;
  noteNonce: number;
};

/** Type guard for non-negative integers */
function isUint(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Assertion helper with type narrowing */
function assert(condition: unknown, message: () => string): asserts condition {
  if (!condition) throw new Error(message());
}

export type IncomingChannelCursor = {
  channelKey: ChannelKey;
  subchannelIdIndex: number;
  noteIndexes: AddressMap<number>; // token -> i
  totalNoteCounts: AddressMap<number>; // token -> total notes found by boundary finder
};

export type NotesCursor = {
  /* when was this cursor valid */
  blockId: BlockIdentifier;
  /* per sender, a cursor to the subcahnels they opened and notes they created */
  incomingChannels: AddressMap<IncomingChannelCursor>; // sender -> cursor
};

export function cloneNotesCursor(cursor?: NotesCursor): NotesCursor {
  if (!cursor) {
    return {
      blockId: 0,
      incomingChannels: new AddressMap<IncomingChannelCursor>(),
    };
  }

  const cloneIncomingChannelCursor = (sc: IncomingChannelCursor): IncomingChannelCursor => ({
    channelKey: sc.channelKey,
    subchannelIdIndex: sc.subchannelIdIndex,
    noteIndexes: new AddressMap<number>(sc.noteIndexes.entries()),
    totalNoteCounts: new AddressMap<number>(sc.totalNoteCounts.entries()),
  });

  const incomingChannels = new AddressMap<IncomingChannelCursor>(
    [...cursor.incomingChannels.entries()].map(
      ([k, v]): [StarknetAddressBigint, IncomingChannelCursor] => [k, cloneIncomingChannelCursor(v)]
    )
  );
  return {
    blockId: cursor.blockId,
    incomingChannels: incomingChannels,
  };
}

export type RecipientsFilter<T = StarknetAddressBigint> = T[] | "all" | "total-only";

export type ChannelCursor = {
  channels?: AddressMap<Channel>;
  total?: number;
};
export function cloneChannelCursor(cursor?: ChannelCursor): ChannelCursor {
  if (!cursor) {
    return {
      channels: new AddressMap<Channel>(),
      total: undefined,
    };
  }

  return {
    channels: cursor.channels
      ? new AddressMap<Channel>(
          [...cursor.channels.entries()].map(([k, v]): [StarknetAddressBigint, Channel] => [
            k,
            v.clone(),
          ])
        )
      : undefined,
    total: cursor.total,
  };
}

type ChannelKey = bigint;

/** Channel containing nonces for token and note creation. */
export class Channel {
  readonly publicKey: PublicKey;
  key?: ChannelKey;
  readonly tokens: AddressMap<TokenChannel>; // for the next note for each token

  constructor(
    publicKey: PublicKey,
    key?: ChannelKey,
    tokens?: Iterable<[StarknetAddress, TokenChannel]>
  ) {
    this.publicKey = publicKey;
    this.key = key;
    this.tokens = new AddressMap<TokenChannel>(() => {
      return { tokenIndex: 0, noteNonce: 0 };
    });
    if (tokens) {
      for (const [k, v] of tokens) {
        this.tokens.set(k, v);
      }
    }
  }

  incrementNoteNonce(token: StarknetAddress): number {
    const current = this.tokens.get(token)!;
    current.noteNonce += 1;
    this.tokens.set(token, current);
    return current.noteNonce;
  }

  /** Create a deep clone of this channel */
  clone(): Channel {
    return new Channel(this.publicKey, this.key, this.tokens.entries());
  }

  toSetupRequirement(token: StarknetAddressBigint): SetupRequirement {
    if (!this.publicKey) {
      return SetupRequirement.Register;
    }
    if (!this.key) {
      return SetupRequirement.SetupChannel;
    }
    if (!this.tokens.has(token)) {
      return SetupRequirement.SetupToken;
    }
    return SetupRequirement.Ready;
  }
}

export const channelSerde: ChannelSerde = {
  encode(channel) {
    // jsonStringify handles bigint keys automatically
    const json = jsonStringify({
      v: 1,
      key: channel.key,
      recipientPublicKey: channel.publicKey,
      tokens: Array.from(channel.tokens.entries()).map(([k, v]) => [
        k,
        {
          tokenIndex: v.tokenIndex,
          noteNonce: v.noteNonce,
        },
      ]),
    });
    return json as Blob<string>;
  },
  decode(blob) {
    // jsonParse restores bigints automatically
    const parsed = jsonParse(blob as string);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("Invalid channel payload");
    }
    const { key, recipientPublicKey, tokens } = parsed as Record<string, unknown>;
    const decodedKey = assertOptionalChannelKey(key);
    const decodedPublicKey = assertChannelKey(recipientPublicKey);
    const decodedTokens = assertTokenEntries(tokens);

    return new Channel(decodedPublicKey, decodedKey, decodedTokens);
  },
};

/** Witness for a note, containing channel key and nonce. */
export class Witness {
  readonly channelKey: ChannelKey;
  readonly nonce: number;
  readonly r: bigint;

  constructor(channelKey: ChannelKey, nonce: number, r: bigint) {
    this.channelKey = channelKey;
    this.nonce = nonce;
    this.r = r;
  }
}

export const witnessSerde: WitnessSerde = {
  encode(witness) {
    const json = jsonStringify({
      v: 1,
      channelKey: witness.channelKey,
      nonce: { sequence: witness.nonce },
      r: witness.r,
    });
    return json as Blob<string>;
  },
  decode(blob) {
    const parsed = jsonParse(blob as string);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("Invalid witness payload");
    }
    const { channelKey, nonce, r } = parsed as Record<string, unknown>;
    const decodedChannelKey = assertChannelKey(channelKey);
    const decodedNonce = assertNoteNonce(nonce);
    const decodedR = assertBigInt(r);

    return new Witness(decodedChannelKey, decodedNonce, decodedR);
  },
};

function assertChannelKey(value: unknown): ChannelKey {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  throw new Error("Invalid channel key");
}

function assertOptionalChannelKey(value: unknown): ChannelKey | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return assertChannelKey(value);
}

function assertBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  throw new Error("Invalid bigint");
}

function assertNoteNonce(value: unknown): number {
  if (typeof value === "number") {
    assert(isUint(value), () => "Invalid nonce: must be a non-negative integer");
    return value;
  }
  // Backwards compatibility or object handling if strictly needed, but let's stick to simple number
  assert(
    value !== null && typeof value === "object",
    () => "Invalid nonce: expected number or object"
  );
  const { sequence } = value as Record<string, unknown>;
  assert(isUint(sequence), () => "Invalid nonce: sequence must be a non-negative integer");
  return sequence;
}

function assertTokenEntries(value: unknown): Map<StarknetAddress, TokenChannel> {
  if (!Array.isArray(value)) {
    throw new Error("Invalid tokens");
  }
  const entries: [StarknetAddress, TokenChannel][] = value.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error("Invalid token entry");
    }
    const [token, nonces] = entry as [unknown, Record<string, unknown>];
    const { tokenIndex, noteNonce } = nonces;
    return [
      token as StarknetAddress,
      {
        tokenIndex: assertTokenIndex(tokenIndex),
        noteNonce: assertNoteNonce(noteNonce),
      },
    ];
  });
  return new Map(entries);
}

function assertTokenIndex(value: unknown): number {
  if (typeof value === "number") {
    assert(isUint(value), () => "Invalid token index: must be a non-negative integer");
    return value;
  }
  assert(
    value !== null && typeof value === "object",
    () => "Invalid nonce: expected number or object"
  );
  const { sequence } = value as Record<string, unknown>;
  assert(isUint(sequence), () => "Invalid nonce: sequence must be a non-negative integer");
  return sequence;
}
