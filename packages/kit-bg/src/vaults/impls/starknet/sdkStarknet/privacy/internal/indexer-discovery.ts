import type { BlockIdentifier } from "starknet";
import {
  SetupRequirement,
  type Channel as ChannelInterface,
  type Note,
  type StarknetAddress,
  type StarknetAddressBigint,
  type ViewingKey,
} from "../interfaces";
import { toBigInt } from "../utils/crypto";
import { toHex } from "../utils/convert";
import { AddressMap } from "../utils/maps";
import { AbstractDiscoveryProvider } from "./abstract-discovery";
import { Channel, Witness } from "./channel";
// onekey: AbortSignal.timeout is absent on Hermes and older WebViews.
import { timeoutSignal } from "../platform/timeoutSignal";
import { OhttpClient } from "./ohttp-client";
import { ReorgError } from "./errors";
import type {
  ChannelCursor,
  IncomingChannelCursor,
  NotesCursor,
  RecipientsFilter,
} from "./channel";
import type { ApiHistoryResponse, HistoryCursor, HistoryPage } from "./history";
import { buildHistoryCursor, historyCursorToApi, apiResponseToHistoryPage } from "./history";

/** HTTP 409 — the discovery service returns this exclusively for block reorgs (BLOCK_REORGED). */
const REORG_STATUS = 409;

// API JSON wire types

type ApiSubchannelCursor = {
  note_discovery_complete?: boolean;
  last_note_index?: number;
  total_n_notes?: number;
};

type ApiChannelCursor = {
  channel_key?: string;
  subchannel_discovery_complete?: boolean;
  last_subchannel_index?: number;
  subchannels?: Record<string, ApiSubchannelCursor>;
};

type ApiDiscoveryCursor = {
  channel_discovery_complete?: boolean;
  total_n_channels?: number;
  last_channel_index?: number;
  channels?: Record<string, ApiChannelCursor>;
};

type ApiIncomingChannel = {
  channel_key: string;
  sender_addr: string;
};

type ApiIncomingSubchannelInfo = {
  sender_addr: string;
  token: string;
};

type ApiIncomingNoteInfo = {
  sender_addr: string;
  token: string;
  index: number;
  note_id: string;
  amount: string;
  salt: string;
  block_number: number;
};

type ApiOutgoingChannel = {
  recipient_addr: string;
  recipient_public_key: string;
  channel_key: string;
  precomputed?: boolean;
};

type ApiOutgoingSubchannelInfo = {
  recipient_addr: string;
  token: string;
  last_note_index: number | null;
};

type ApiIncomingSyncResponse = {
  block_ref: BlockIdentifier;
  channels: ApiIncomingChannel[];
  subchannels: ApiIncomingSubchannelInfo[];
  notes: ApiIncomingNoteInfo[];
  cursor: ApiDiscoveryCursor;
};

type ApiOutgoingSyncResponse = {
  block_ref: BlockIdentifier;
  channels: ApiOutgoingChannel[];
  subchannels: ApiOutgoingSubchannelInfo[];
  cursor: ApiDiscoveryCursor;
};

export type DiscoveryHealthResponse = {
  status: string;
  chain_head?: { block_number: number; block_hash: string; timestamp: number };
  lag_secs?: number;
};

export class IndexerDiscoveryProvider extends AbstractDiscoveryProvider {
  private readonly ohttpClient?: OhttpClient;

  constructor(
    private readonly apiUrl: string,
    private readonly contractAddress: StarknetAddress,
    options?: { ohttp?: boolean | { relayUrl?: string; publicKeyConfig?: Uint8Array } }
  ) {
    super();
    if (options?.ohttp) {
      const ohttpOptions =
        typeof options.ohttp === "object"
          ? { relayUrl: options.ohttp.relayUrl, publicKeyConfig: options.ohttp.publicKeyConfig }
          : undefined;
      this.ohttpClient = new OhttpClient(apiUrl, ohttpOptions);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const body = await this.get<{ status: string }>("/health");
      return body.status === "OK";
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<DiscoveryHealthResponse> {
    return this.get<DiscoveryHealthResponse>("/health");
  }

  async discoverNotes(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    params?: {
      cursor?: NotesCursor;
      tokens?: StarknetAddressBigint[];
      blockIdentifier?: BlockIdentifier;
    }
  ): Promise<{ timestamp: BlockIdentifier; notes: AddressMap<Note[]>; cursor: NotesCursor }> {
    const tokenFilter = params?.tokens ? new Set(params.tokens.map(toBigInt)) : null;
    const cursor = params?.cursor;
    let apiCursor: ApiDiscoveryCursor = cursor ? notesCursorToApiCursor(cursor, tokenFilter) : {};

    // last_known_block is sent once on the first request for reorg detection.
    // block_ref (from the first response) pins subsequent pagination requests.
    const lastKnownBlock = cursor?.blockId as string | undefined;
    let blockRef: BlockIdentifier | undefined;

    const allNotes = new AddressMap<Note[]>(() => []);
    const incomingChannels = new AddressMap<IncomingChannelCursor>();

    let complete = false;
    do {
      const body: Record<string, unknown> = {
        contract_address: toHex(this.contractAddress),
        recipient_address: toHex(address),
        viewing_key: toHex(viewingKey),
        cursor: apiCursor,
      };
      if (blockRef) {
        body.block_ref = blockRef;
      } else if (params?.blockIdentifier !== undefined) {
        body.block_ref = params.blockIdentifier;
      } else if (lastKnownBlock) {
        body.last_known_block = lastKnownBlock;
      }

      const resp = await this.post<ApiIncomingSyncResponse>("/v1/sync/incoming_state", body);

      blockRef = resp.block_ref;

      const channelKeyMap = new Map<string, bigint>();
      for (const ch of resp.channels) {
        channelKeyMap.set(ch.sender_addr, BigInt(ch.channel_key));
      }

      const notesByToken = convertIncomingNotes(
        resp.notes,
        channelKeyMap,
        incomingChannels,
        tokenFilter
      );
      for (const [token, tokenNotes] of notesByToken) {
        allNotes.get(token)!.push(...tokenNotes);
      }

      const updatedCursor = apiCursorToNotesCursor(resp.cursor, resp.block_ref);
      for (const [sender, icc] of updatedCursor.incomingChannels) {
        incomingChannels.set(sender, icc);
      }

      apiCursor = resp.cursor;
      complete = isApiCursorComplete(resp.cursor);
    } while (!complete);

    // FIXME: The incoming sync API filters out spent notes (nullifier exists).
    // When a note is spent and removed from the response, we lose information
    // about its index. The constructed noteIndexes[token] is
    // max(surviving_note.index) + 1, which may be lower than the true last
    // discovered index if the highest-index notes were spent. This causes
    // suboptimal incremental updates — the next call re-scans already-discovered
    // (but now spent) note indices.

    const blockIdentifier = blockRef!;
    return {
      timestamp: blockIdentifier,
      notes: allNotes,
      cursor: { blockId: blockIdentifier, incomingChannels },
    };
  }

  async discoverChannels(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipients: RecipientsFilter,
    params?: { cursor?: ChannelCursor; blockIdentifier?: BlockIdentifier }
  ): Promise<{
    timestamp: BlockIdentifier;
    channels?: AddressMap<ChannelInterface>;
    total?: number;
  }> {
    if (recipients === "total-only") {
      // The service sets `total_n_channels` only once channel discovery reaches
      // the sentinel, and a single request discovers at most `max_channels`.
      // Paginate to completion — pruning complete channels each round frees
      // cursor slots so discovery advances past the cap — then the count is final.
      let apiCursor: ApiDiscoveryCursor = { channel_discovery_complete: false };
      let blockRef: BlockIdentifier | undefined;
      let complete = false;
      do {
        const body: Record<string, unknown> = {
          contract_address: toHex(this.contractAddress),
          sender_address: toHex(address),
          viewing_key: toHex(viewingKey),
          cursor: apiCursor,
        };
        if (blockRef) {
          body.block_ref = blockRef;
        } else if (params?.blockIdentifier !== undefined) {
          body.block_ref = params.blockIdentifier;
        }
        const resp = await this.post<ApiOutgoingSyncResponse>("/v1/sync/outgoing_state", body);
        blockRef = resp.block_ref;
        apiCursor = resp.cursor;
        complete = isApiCursorComplete(resp.cursor);
        if (!complete) pruneCompleteCursor(apiCursor);
      } while (!complete);
      if (apiCursor.total_n_channels === undefined) {
        throw new Error("outgoing_state reported complete without total_n_channels");
      }
      return {
        timestamp: blockRef!,
        total: apiCursor.total_n_channels,
      };
    }

    const cursorMap = params?.cursor?.channels;
    let apiCursor: ApiDiscoveryCursor;

    if (recipients === "all") {
      apiCursor = channelMapToApiCursor(cursorMap, false);
    } else {
      let allResolved = true;
      const resolved = new Map<bigint, { key: bigint; publicKey: bigint }>();
      for (const r of recipients) {
        const rb = toBigInt(r);
        const existing = cursorMap?.get(rb);
        if (existing?.key) {
          resolved.set(rb, { key: existing.key, publicKey: toBigInt(existing.publicKey) });
        } else {
          allResolved = false;
        }
      }

      if (allResolved) {
        // Targeted scan: skip channel discovery, only refresh subchannels
        apiCursor = { channel_discovery_complete: true, channels: {} };
        for (const [rb, info] of resolved) {
          const existing = cursorMap?.get(rb);
          const subchannels = existing
            ? buildSubchannelCursors(
                [...existing.tokens].map(([token, nonces]) => [token, nonces.noteNonce]),
                null
              )
            : {};
          apiCursor.channels![toHex(rb)] = {
            channel_key: toHex(info.key),
            subchannel_discovery_complete: false,
            subchannels,
          };
        }
      } else {
        apiCursor = { channel_discovery_complete: false, channels: {} };
      }
    }

    // Accumulate channel/subchannel data across all pagination pages.
    const createdChannelMap = new Map<string, { publicKey: bigint; channelKey: bigint }>();
    const subchannelsByRecipient = new Map<
      string,
      Map<string, { token: bigint; lastIndex: number | null }>
    >();
    const nonCreatedChannelMap = new Map<string, { publicKey: bigint; channelKey: bigint }>();
    let blockRef: BlockIdentifier | undefined;

    let complete = false;
    do {
      const body: Record<string, unknown> = {
        contract_address: toHex(this.contractAddress),
        sender_address: toHex(address),
        viewing_key: toHex(viewingKey),
        cursor: apiCursor,
      };
      if (blockRef) {
        body.block_ref = blockRef;
      } else if (params?.blockIdentifier !== undefined) {
        body.block_ref = params.blockIdentifier;
      }
      if (recipients !== "all") {
        body.recipients = recipients.map((r) => toHex(r));
      }

      const resp = await this.post<ApiOutgoingSyncResponse>("/v1/sync/outgoing_state", body);

      blockRef = resp.block_ref;

      accumulateOutgoingResponse(
        resp,
        createdChannelMap,
        subchannelsByRecipient,
        nonCreatedChannelMap
      );

      apiCursor = resp.cursor;
      complete = isApiCursorComplete(resp.cursor);
      if (!complete) pruneCompleteCursor(apiCursor);
    } while (!complete);

    // Build the final channel map from all accumulated data
    const channels = buildChannelMap(
      createdChannelMap,
      subchannelsByRecipient,
      nonCreatedChannelMap
    );

    if (recipients !== "all") {
      const requested = new Set(recipients.map(toBigInt));
      for (const key of [...channels.keys()]) {
        if (!requested.has(key)) channels.delete(key);
      }
    }

    // The loop above runs to the sentinel, so the final cursor carries the
    // authoritative outgoing-channel count. Surface it so callers opening a new
    // channel can reuse it instead of issuing a separate "total-only" query.
    return { timestamp: blockRef!, channels, total: apiCursor.total_n_channels };
  }

  // onekey: `override` required by the repo tsconfig (noImplicitOverride).
  override async discoverRequirement(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipient: StarknetAddressBigint,
    token: StarknetAddressBigint
  ): Promise<SetupRequirement> {
    const resp = await this.post<{
      block_ref: string;
      sender_registered: boolean;
      channel_exists: boolean;
      subchannel_exists: boolean;
    }>("/v1/sync/preflight_check", {
      contract_address: toHex(this.contractAddress),
      sender_address: toHex(address),
      viewing_key: toHex(viewingKey),
      recipient: toHex(recipient),
      token: toHex(token),
    });
    if (!resp.sender_registered) return SetupRequirement.Register;
    if (!resp.channel_exists) return SetupRequirement.SetupChannel;
    if (!resp.subchannel_exists) return SetupRequirement.SetupToken;
    return SetupRequirement.Ready;
  }

  async fetchHistory(
    userAddress: StarknetAddressBigint,
    notesCursor: NotesCursor,
    channelCursor: ChannelCursor,
    options?: {
      maxTransactions?: number;
      lastKnownBlock?: string;
      blockIdentifier?: BlockIdentifier;
      /** Pass the cursor from a previous HistoryPage to continue pagination. */
      historyCursor?: HistoryCursor;
    }
  ): Promise<HistoryPage> {
    const cursor =
      options?.historyCursor ?? buildHistoryCursor(userAddress, notesCursor, channelCursor);
    const body: Record<string, unknown> = {
      contract_address: toHex(this.contractAddress),
      user_address: toHex(userAddress),
      max_transactions: options?.maxTransactions ?? 50,
      cursor: historyCursorToApi(cursor),
    };
    if (options?.blockIdentifier !== undefined) {
      body.block_ref = options.blockIdentifier;
    } else if (options?.lastKnownBlock) {
      body.last_known_block = options.lastKnownBlock;
    }
    const resp = await this.post<ApiHistoryResponse>("/v1/history", body);
    return apiResponseToHistoryPage(resp);
  }

  private async get<T>(path: string): Promise<T> {
    if (this.ohttpClient) {
      return this.ohttpClient.get<T>(path);
    }
    const resp = await fetch(`${this.apiUrl}${path}`, {
      signal: timeoutSignal(8_000),
    });
    if (!resp.ok) {
      throw new Error(`Indexer API ${path} failed (${resp.status})`);
    }
    return resp.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (this.ohttpClient) {
      return this.ohttpClient.post<T>(path, body);
    }
    const resp = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      if (resp.status === REORG_STATUS) {
        throw new ReorgError(`Block reorged during ${path}: ${text}`);
      }
      throw new Error(`Indexer API ${path} failed (${resp.status}): ${text}`);
    }
    return resp.json() as Promise<T>;
  }
}

/** Mirrors Rust `DiscoveryCursor::is_complete()`. */
function isApiCursorComplete(cursor: ApiDiscoveryCursor): boolean {
  if (!cursor.channel_discovery_complete) return false;
  if (!cursor.channels) return true;
  return Object.values(cursor.channels).every(
    (ch) =>
      ch.subchannel_discovery_complete &&
      (!ch.subchannels || Object.values(ch.subchannels).every((sc) => !!sc.note_discovery_complete))
  );
}

/** Builds `Record<string, ApiSubchannelCursor>` from token→noteIndex pairs, optionally filtered. */
export function buildSubchannelCursors(
  noteIndexes: Iterable<[StarknetAddressBigint, number]>,
  tokenFilter: Set<bigint> | null,
  totalNoteCounts?: AddressMap<number>
): Record<string, ApiSubchannelCursor> {
  const subchannels: Record<string, ApiSubchannelCursor> = {};
  for (const [token, noteIndex] of noteIndexes) {
    if (tokenFilter && !tokenFilter.has(toBigInt(token))) continue;
    const cursor: ApiSubchannelCursor = {
      last_note_index: noteIndex > 0 ? noteIndex - 1 : undefined,
    };
    const noteCount = totalNoteCounts?.get(toBigInt(token));
    if (noteCount != null) {
      cursor.total_n_notes = noteCount;
    }
    subchannels[toHex(token)] = cursor;
  }
  return subchannels;
}

/** Converts SDK `NotesCursor` -> API cursor for an incoming sync request. */
export function notesCursorToApiCursor(
  cursor: NotesCursor,
  tokenFilter: Set<bigint> | null
): ApiDiscoveryCursor {
  const apiCursor: ApiDiscoveryCursor = {
    channel_discovery_complete: false,
    last_channel_index:
      cursor.incomingChannels.size > 0 ? cursor.incomingChannels.size - 1 : undefined,
    channels: {},
  };
  for (const [sender, icc] of cursor.incomingChannels) {
    const subchannels = buildSubchannelCursors(icc.noteIndexes, tokenFilter, icc.totalNoteCounts);
    apiCursor.channels![toHex(sender)] = {
      channel_key: toHex(icc.channelKey),
      subchannel_discovery_complete:
        tokenFilter != null && tokenFilter.size === Object.keys(subchannels).length,
      last_subchannel_index: icc.subchannelIdIndex > 0 ? icc.subchannelIdIndex - 1 : undefined,
      subchannels,
    };
  }
  return apiCursor;
}

/** Converts API cursor from an incoming sync response → SDK `NotesCursor`. */
export function apiCursorToNotesCursor(
  apiCursor: ApiDiscoveryCursor,
  blockRef: BlockIdentifier
): NotesCursor {
  const incomingChannels = new AddressMap<IncomingChannelCursor>();
  if (apiCursor.channels) {
    for (const [senderHex, ch] of Object.entries(apiCursor.channels)) {
      const channelKey = ch.channel_key ? BigInt(ch.channel_key) : 0n;
      const noteIndexes = new AddressMap<number>();
      const totalNoteCounts = new AddressMap<number>();
      if (ch.subchannels) {
        for (const [tokenHex, sc] of Object.entries(ch.subchannels)) {
          noteIndexes.set(BigInt(tokenHex), (sc.last_note_index ?? -1) + 1);
          if (sc.total_n_notes != null) {
            totalNoteCounts.set(BigInt(tokenHex), sc.total_n_notes);
          }
        }
      }
      incomingChannels.set(BigInt(senderHex), {
        channelKey,
        subchannelIdIndex: (ch.last_subchannel_index ?? -1) + 1,
        noteIndexes,
        totalNoteCounts,
      });
    }
  }
  return { blockId: blockRef, incomingChannels };
}

/** Converts SDK `AddressMap<Channel>` → API cursor for an outgoing sync request. */
export function channelMapToApiCursor(
  channels: AddressMap<ChannelInterface> | undefined,
  channelDiscoveryComplete: boolean
): ApiDiscoveryCursor {
  const apiCursor: ApiDiscoveryCursor = {
    channel_discovery_complete: channelDiscoveryComplete,
    channels: {},
  };
  if (channels) {
    for (const [recipient, channel] of channels) {
      if (!channel.key) continue;
      const subchannels = buildSubchannelCursors(
        [...channel.tokens].map(([token, nonces]) => [token, nonces.noteNonce]),
        null
      );
      apiCursor.channels![toHex(recipient)] = {
        channel_key: toHex(channel.key),
        subchannel_discovery_complete: false,
        subchannels,
      };
    }
  }
  return apiCursor;
}

/** Accumulates outgoing sync response data into maps across multiple pages. */
function accumulateOutgoingResponse(
  resp: ApiOutgoingSyncResponse,
  createdChannelMap: Map<string, { publicKey: bigint; channelKey: bigint }>,
  subchannelsByRecipient: Map<string, Map<string, { token: bigint; lastIndex: number | null }>>,
  nonCreatedChannelMap: Map<string, { publicKey: bigint; channelKey: bigint }>
): void {
  for (const ch of resp.channels) {
    const info = { publicKey: BigInt(ch.recipient_public_key), channelKey: BigInt(ch.channel_key) };
    if (ch.precomputed) {
      // Precomputed channels may duplicate a real channel discovered in a
      // later pagination step. The created map takes precedence.
      if (!createdChannelMap.has(ch.recipient_addr)) {
        nonCreatedChannelMap.set(ch.recipient_addr, info);
      }
    } else {
      createdChannelMap.set(ch.recipient_addr, info);
      // Promote: if we previously saw a precomputed entry, the real one wins.
      nonCreatedChannelMap.delete(ch.recipient_addr);
    }
  }

  for (const sc of resp.subchannels) {
    let tokenMap = subchannelsByRecipient.get(sc.recipient_addr);
    if (!tokenMap) {
      tokenMap = new Map();
      subchannelsByRecipient.set(sc.recipient_addr, tokenMap);
    }
    const existing = tokenMap.get(sc.token);
    // Keep the most informative value: non-null overrides null
    if (!existing || sc.last_note_index !== null) {
      tokenMap.set(sc.token, { token: BigInt(sc.token), lastIndex: sc.last_note_index });
    }
  }
}

/** Builds the final SDK channel map from accumulated outgoing sync data. */
function buildChannelMap(
  createdChannelMap: Map<string, { publicKey: bigint; channelKey: bigint }>,
  subchannelsByRecipient: Map<string, Map<string, { token: bigint; lastIndex: number | null }>>,
  nonCreatedChannelMap: Map<string, { publicKey: bigint; channelKey: bigint }>
): AddressMap<ChannelInterface> {
  const channels = new AddressMap<ChannelInterface>();

  for (const [recipientHex, info] of createdChannelMap) {
    const tokens = new AddressMap<{ tokenIndex: number; noteNonce: number }>();
    const subs = subchannelsByRecipient.get(recipientHex);
    if (subs) {
      let tokenIndex = 0;
      for (const [, sub] of subs) {
        tokens.set(sub.token, {
          tokenIndex: tokenIndex++,
          noteNonce: sub.lastIndex !== null ? sub.lastIndex + 1 : 0,
        });
      }
    }
    channels.set(
      BigInt(recipientHex),
      new Channel(info.publicKey, info.channelKey, tokens.entries())
    );
  }

  for (const [recipientHex, info] of nonCreatedChannelMap) {
    const addr = BigInt(recipientHex);
    if (!channels.has(addr)) {
      channels.set(addr, new Channel(info.publicKey));
    }
  }

  return channels;
}

/** Prunes complete channels/subchannels from an API cursor to reduce payload size. */
function pruneCompleteCursor(cursor: ApiDiscoveryCursor): void {
  if (!cursor.channels) return;
  for (const [addr, ch] of Object.entries(cursor.channels)) {
    if (ch.subchannel_discovery_complete && ch.subchannels) {
      for (const [token, sc] of Object.entries(ch.subchannels)) {
        if (sc.note_discovery_complete) {
          delete ch.subchannels[token];
        }
      }
      if (Object.keys(ch.subchannels).length === 0) {
        delete cursor.channels[addr];
      }
    }
  }
}

/** Converts API incoming notes → SDK `Note` objects grouped by token. */
export function convertIncomingNotes(
  apiNotes: ApiIncomingNoteInfo[],
  channelKeyMap: Map<string, bigint>,
  existingChannels: AddressMap<IncomingChannelCursor>,
  tokenFilter: Set<bigint> | null
): AddressMap<Note[]> {
  const result = new AddressMap<Note[]>(() => []);
  for (const n of apiNotes) {
    const token = BigInt(n.token);
    if (tokenFilter && !tokenFilter.has(token)) continue;
    const sender = BigInt(n.sender_addr);
    const channelKey = channelKeyMap.get(n.sender_addr) ?? existingChannels.get(sender)?.channelKey;
    if (channelKey == null) {
      throw new Error(
        `Missing channel_key for sender ${n.sender_addr}: not found in current response or previous pages`
      );
    }
    result.get(token)!.push({
      id: n.note_id,
      amount: BigInt(n.amount),
      created: n.block_number,
      witness: new Witness(channelKey, n.index, BigInt(n.salt)),
      sender,
      open: n.salt === "1",
    });
  }
  return result;
}
