import { BlockIdentifier } from "starknet";
import { ViewingKey, Note, Channel, StarknetAddressBigint } from "../interfaces";
import { AddressMap } from "../utils/maps";
import { AbstractDiscoveryProvider } from "./abstract-discovery";
import { debugLog } from "../utils/logging";
import { toBigInt } from "../utils/crypto";
import { toHex } from "../utils/convert";
import {
  compute_channel_key,
  compute_channel_marker,
  compute_subchannel_id,
  compute_note_id,
  compute_outgoing_channel_id,
  compute_nullifier,
} from "../utils/hashes";
import { encryptions } from "../utils/encryptions";
import { cloneNotesCursor, cloneChannelCursor } from "./channel";
import type { ChannelCursor, NotesCursor, RecipientsFilter } from "./channel";
import { bisect, scan, Tracker } from "../utils/scan";
import { createRateLimitedObject, type RateLimitOptions } from "../utils/rate-limiter";
import type { PoolContractInterface, NoteData } from "./pool-contract-interface";

// Re-export types from generated file
export type { PoolContractInterface, NoteData } from "./pool-contract-interface";

class NotesDiscovery {
  private readonly tracker = new Tracker();
  private readonly notes = new AddressMap<Note[]>(() => []);
  private readonly cursor: NotesCursor;
  constructor(
    private readonly address: StarknetAddressBigint,
    private readonly viewingKey: ViewingKey,
    private readonly existingCursor: NotesCursor | undefined,
    private readonly tokens: Set<StarknetAddressBigint>,
    private readonly pool: PoolContractInterface
  ) {
    this.cursor = cloneNotesCursor(this.existingCursor);
  }

  async discover(): Promise<{
    timestamp: BlockIdentifier;
    notes: AddressMap<Note[]>;
    cursor: NotesCursor;
  }> {
    void this.tracker.add(this.discoverChannels(this.existingCursor?.incomingChannels.size ?? 0));
    for (const [sender, incomingChannelCursor] of this.existingCursor?.incomingChannels ?? []) {
      void this.tracker.add(this.discoverSubchannels(sender));
      for (const [token, index] of incomingChannelCursor.noteIndexes) {
        void this.tracker.add(this.discoverNotes(sender, token, index));
      }
    }

    await this.tracker.wait();
    return {
      timestamp: 0,
      notes: this.notes,
      cursor: this.cursor,
    };
  }

  async discoverChannels(start: number): Promise<void> {
    debugLog("contract-discovery", "discoverNotes", "start", this.cursor);
    const nc = await this.pool.get_num_of_channels(this.address);
    debugLog("contract-discovery", "discoverNotes", "num of channels", nc);
    void bisect(
      async (c) => {
        const encryptedChannel = await this.pool.get_channel_info(this.address, c);
        const channel = encryptions.decryptChannelInfo(encryptedChannel, this.viewingKey);
        debugLog("contract-discovery", "discoverNotes", "channel", channel);
        const incomingChannelCursor = {
          channelKey: channel.key,
          subchannelIdIndex: 0,
          noteIndexes: new AddressMap<number>(),
          totalNoteCounts: new AddressMap<number>(),
        };
        this.cursor!.incomingChannels.set(channel.sender, incomingChannelCursor);

        // no await on purpose - but must track the promise
        void this.tracker.add(this.discoverSubchannels(channel.sender));
        return true;
      },
      start,
      Number(nc),
      this.tracker
    );
  }

  async discoverSubchannels(sender: StarknetAddressBigint): Promise<void> {
    const incomingChannelCursor = this.cursor!.incomingChannels.get(sender)!;
    const channelKey = incomingChannelCursor.channelKey;
    void scan(
      async (k) => {
        const encSubchannel = await this.pool.get_subchannel_info(
          compute_subchannel_id(channelKey, k)
        );
        if (toBigInt(encSubchannel.salt) === 0n) return false;

        // no await until the end
        debugLog(
          "contract-discovery",
          "discoverNotes",
          "encSubchannel",
          encSubchannel,
          () => compute_subchannel_id(channelKey, k),
          k
        );
        const { token } = encryptions.decryptSubchannelInfo(encSubchannel, channelKey, k);
        // skip tokens the caller doesn't want to discover
        if ((this.tokens?.size ?? 0) > 0 && !this.tokens.has(token)) {
          debugLog("contract-discovery", "discoverNotes", "skipping token", token);
          return true;
        }
        debugLog("contract-discovery", "discoverNotes", "subchannel", sender, token, k);
        incomingChannelCursor.noteIndexes.set(token, 0);
        incomingChannelCursor.subchannelIdIndex = Math.max(
          incomingChannelCursor.subchannelIdIndex,
          k
        );

        // no await on purpose - but must track the promise
        void this.tracker.add(this.discoverNotes(sender, token, 0));

        return true;
      },
      incomingChannelCursor.subchannelIdIndex,
      this.tracker
    );
  }

  async discoverNotes(
    sender: StarknetAddressBigint,
    token: StarknetAddressBigint,
    index: number
  ): Promise<void> {
    const incomingChannelCursor = this.cursor!.incomingChannels.get(sender)!;
    const channelKey = incomingChannelCursor.channelKey;
    void scan(
      async (i, skipResult?: boolean) => {
        const noteId = compute_note_id(channelKey, token, i);

        if (skipResult) {
          // Touch mode: check nullifier first (optimization - skip note fetch if spent)
          const nullifier = compute_nullifier(channelKey, token, i, BigInt(this.viewingKey));
          const isSpent = await this.pool.nullifier_exists(nullifier);
          if (isSpent) return true; // note exists but spent, skip entirely

          // Not spent - fetch note and add
          const noteData = await this.pool.get_note(noteId);
          const packedValue = toBigInt(noteData.packed_value);
          if (packedValue === 0n) return false;

          await this.addNoteIfNotSpent(noteId, noteData, i, channelKey, token, sender, true);
          return true;
        }

        // Boundary mode: check note first, then async nullifier check
        const noteData = await this.pool.get_note(noteId);
        const packedValue = toBigInt(noteData.packed_value);
        if (packedValue === 0n) return false; // boundary found

        // Fire-and-forget: check nullifier and maybe add
        void this.tracker.add(
          this.addNoteIfNotSpent(noteId, noteData, i, channelKey, token, sender, false)
        );
        return true; // note exists, return immediately
      },
      index,
      this.tracker
    );
  }

  /** Helper to check nullifier and add note if not spent */
  private async addNoteIfNotSpent(
    noteId: bigint,
    noteData: NoteData,
    index: number,
    channelKey: bigint,
    token: StarknetAddressBigint,
    sender: StarknetAddressBigint,
    skipNullifierCheck: boolean
  ): Promise<boolean> {
    if (!skipNullifierCheck) {
      const nullifier = compute_nullifier(channelKey, token, index, BigInt(this.viewingKey));
      const isSpent = await this.pool.nullifier_exists(nullifier);
      if (isSpent) return true; // spent, don't add
    }

    const packedValue = toBigInt(noteData.packed_value);

    // Extract salt from upper 128 bits to determine note type
    // salt = OPEN_NOTE_SALT (=1) indicates an open note
    // salt > OPEN_NOTE_SALT (>=2) indicates an encrypted note
    const packedSalt = packedValue >> 128n;
    const isOpenNote = packedSalt === 1n;

    let amount: bigint;
    let salt: bigint;

    if (isOpenNote) {
      // Open notes: amount is in lower 128 bits (plaintext), salt is always 1
      amount = packedValue & ((1n << 128n) - 1n);
      salt = 1n;
    } else {
      // Encrypted notes: decrypt to get amount and salt
      const decrypted = encryptions.decryptNoteAmount(packedValue, channelKey, token, index);
      amount = decrypted.amount;
      salt = decrypted.salt;
    }

    debugLog(
      "contract-discovery",
      "discoverNotes",
      "note",
      sender,
      token,
      index,
      amount,
      isOpenNote ? "open" : "encrypted"
    );
    this.notes.get(token)!.push({
      id: noteId,
      amount,
      created: 0,
      witness: { channelKey, nonce: index, r: salt },
      sender,
      open: isOpenNote,
    });

    const m = this.cursor!.incomingChannels.get(sender)!.noteIndexes.get(token)!;
    this.cursor!.incomingChannels.get(sender)!.noteIndexes.set(token, Math.max(m, index + 1));
    return true;
  }
}

class ChannelsDiscovery {
  private readonly tracker = new Tracker();
  private readonly channels: AddressMap<Channel>;
  private total?: number;
  constructor(
    private readonly address: StarknetAddressBigint,
    private readonly viewingKey: bigint,
    private readonly recipients: RecipientsFilter,
    private readonly cursor: ChannelCursor | undefined,
    private readonly pool: PoolContractInterface
  ) {
    const { channels, total } = cloneChannelCursor(cursor);
    this.channels = channels!;
    this.total = total;
  }

  async discover(): Promise<{
    timestamp: BlockIdentifier;
    channels?: AddressMap<Channel>;
    total?: number;
  }> {
    if (this.recipients == "all" || this.recipients == "total-only") {
      void scan(
        async (s) => {
          const encOutgoingChannelInfo = await this.pool.get_outgoing_channel_info(
            compute_outgoing_channel_id(this.address, toBigInt(this.viewingKey), s)
          );
          if (toBigInt(encOutgoingChannelInfo.salt) === 0n) return false;
          if (this.recipients !== "total-only") {
            const { recipientAddr } = encryptions.decryptOutgoingChannelInfo(
              encOutgoingChannelInfo,
              this.address,
              this.viewingKey,
              s
            );
            void this.tracker.add(this.discoverChannel(recipientAddr));
          }
          this.total = Math.max(this.total ?? 0, s + 1);
          return true;
        },
        this.total ?? 0,
        this.tracker,
        this.recipients === "total-only"
      );
    } else {
      for (const recipient of this.recipients) {
        // TODO: this may mean double discovering recipients already probed in the sync above
        void this.tracker.add(this.discoverChannel(toBigInt(recipient)));
      }
    }

    if (this.cursor) {
      // discover subchannels
      for (const [recipient, channel] of this.cursor.channels?.entries() ?? []) {
        if (!channel.key) continue;
        void this.tracker.add(this.discoverSubchannels(recipient, channel));
        // discover note indexes
        for (const [token, nonces] of channel.tokens) {
          void this.tracker.add(this.discoverNotes(recipient, channel, token, nonces.noteNonce));
        }
      }
    }
    await this.tracker.wait();
    return { timestamp: 0, channels: this.channels, total: this.total };
  }

  private async discoverChannel(recipient: StarknetAddressBigint): Promise<void> {
    debugLog("contract-discovery", "discoverChannels", "recipient", toHex(recipient));
    let channel = this.channels.get(recipient);
    if (channel && channel.key !== 0n) {
      void this.tracker.add(this.discoverSubchannels(recipient, channel));
      return;
    }

    const publicKey =
      this.channels.get(recipient)?.publicKey ?? (await this.pool.get_public_key(recipient));

    debugLog("contract-discovery", "discoverChannels", "publicKey", publicKey);
    if (!publicKey) return;

    channel = this.channels.get(recipient, () => new Channel(publicKey))!;

    const channelKey = compute_channel_key(
      this.address,
      this.viewingKey,
      recipient,
      toBigInt(publicKey)
    );

    const channelMarker = compute_channel_marker(
      channelKey,
      this.address,
      recipient,
      toBigInt(publicKey)
    );

    if (await this.pool.channel_exists(channelMarker)) {
      channel.key = channelKey;
      void this.tracker.add(this.discoverSubchannels(recipient, channel));
    }
  }

  private async discoverSubchannels(
    recipient: StarknetAddressBigint,
    channel: Channel
  ): Promise<void> {
    void scan(
      async (k) => {
        const encSubchannel = await this.pool.get_subchannel_info(
          compute_subchannel_id(channel.key!, k)
        );
        if (toBigInt(encSubchannel.salt) === 0n) return false;
        const { token } = encryptions.decryptSubchannelInfo(encSubchannel, channel.key!, k);
        this.channels.get(recipient)!.tokens.set(token, { tokenIndex: k, noteNonce: 0 });
        void this.tracker.add(this.discoverNotes(recipient, channel, token, 0));
        return true;
      },
      channel.tokens.size ?? 0,
      this.tracker
    );
  }

  private async discoverNotes(
    recipient: StarknetAddressBigint,
    channel: Channel,
    token: StarknetAddressBigint,
    index: number
  ): Promise<void> {
    void scan(
      async (i) => {
        const noteData = await this.pool.get_note(compute_note_id(channel.key!, token, i));
        if (toBigInt(noteData.packed_value) === 0n) return false;
        const nonces = this.channels.get(recipient)!.tokens.get(token)!;
        nonces.noteNonce = Math.max(nonces.noteNonce, i + 1);
        return true;
      },
      index,
      this.tracker,
      true
    );
  }
}

/**
 * Options for ContractDiscoveryProvider.
 */
export type DiscoveryOptions = {
  /** Rate limiting for pool contract RPC calls */
  rateLimit?: RateLimitOptions;
};

export class ContractDiscoveryProvider extends AbstractDiscoveryProvider {
  private readonly pool: PoolContractInterface;

  constructor(pool: PoolContractInterface, options?: DiscoveryOptions) {
    super();
    this.pool = options?.rateLimit ? createRateLimitedObject(pool, options.rateLimit) : pool;
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
    const discovery = new NotesDiscovery(
      address,
      viewingKey,
      params?.cursor,
      new Set(params?.tokens ?? []),
      this.pool
    );
    return discovery.discover();
  }

  async discoverChannels(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipients: RecipientsFilter,
    params?: { cursor?: ChannelCursor; blockIdentifier?: BlockIdentifier }
  ): Promise<{ timestamp: BlockIdentifier; channels?: AddressMap<Channel>; total?: number }> {
    const discovery = new ChannelsDiscovery(
      address,
      toBigInt(viewingKey),
      recipients,
      params?.cursor,
      this.pool
    );
    return discovery.discover();
  }
}
