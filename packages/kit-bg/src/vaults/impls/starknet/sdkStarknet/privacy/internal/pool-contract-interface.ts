/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated from sdk/src/internal/abi.ts
 * Run: npx tsx scripts/generate-pool-interface.ts
 */

import { BigNumberish, CairoCustomEnum } from "starknet";

// ============ Struct Types ============

export type EncChannelInfo = {
  ephemeral_pubkey: BigNumberish;
  enc_channel_key: BigNumberish;
  enc_sender_addr: BigNumberish;
};

export type EncSubchannelInfo = {
  salt: BigNumberish;
  enc_token: BigNumberish;
};

export type EncOutgoingChannelInfo = {
  salt: BigNumberish;
  enc_recipient_addr: BigNumberish;
};

export type NoteData = {
  packed_value: BigNumberish;
  token: BigNumberish;
};

export type EncPrivateKey = {
  auditor_public_key: BigNumberish;
  ephemeral_pubkey: BigNumberish;
  enc_private_key: BigNumberish;
};

// ============ Pool Contract Interface ============

/**
 * Interface for pool contract view methods.
 * Generated from IViews interface in the ABI.
 *
 * Return types are widened to accept sync and async implementations:
 * - Methods can return T | Promise<T>
 * - Implementations should defensively convert values with toBigInt()
 */
export interface PoolContractInterface {
  channel_exists(channelMarker: BigNumberish): boolean | Promise<boolean>;
  get_num_of_channels(recipientAddr: BigNumberish): bigint | number | Promise<bigint | number>;
  get_channel_info(recipientAddr: BigNumberish, channelIndex: BigNumberish): EncChannelInfo | Promise<EncChannelInfo>;
  subchannel_exists(subchannelMarker: BigNumberish): boolean | Promise<boolean>;
  get_subchannel_info(subchannelId: BigNumberish): EncSubchannelInfo | Promise<EncSubchannelInfo>;
  get_outgoing_channel_info(outgoingChannelId: BigNumberish): EncOutgoingChannelInfo | Promise<EncOutgoingChannelInfo>;
  get_note(noteId: BigNumberish): NoteData | Promise<NoteData>;
  nullifier_exists(nullifier: BigNumberish): boolean | Promise<boolean>;
  get_public_key(userAddr: BigNumberish): BigNumberish | Promise<BigNumberish>;
  get_enc_private_key(userAddr: BigNumberish): EncPrivateKey | Promise<EncPrivateKey>;
  get_auditor_public_key(): BigNumberish | Promise<BigNumberish>;
  get_screener_public_key(): BigNumberish | Promise<BigNumberish>;
  get_version(): BigNumberish | Promise<BigNumberish>;
  get_fee_amount(): bigint | number | Promise<bigint | number>;
  get_fee_collector(): BigNumberish | Promise<BigNumberish>;
  get_proof_validity_blocks(): bigint | number | Promise<bigint | number>;
  get_open_note_screening_policy(depositor: BigNumberish): CairoCustomEnum | Promise<CairoCustomEnum>;
}
