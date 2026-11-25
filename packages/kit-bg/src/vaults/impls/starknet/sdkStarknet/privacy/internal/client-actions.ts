/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated from sdk/src/internal/abi.ts
 * Run: npx tsx scripts/generate-client-actions.ts
 */

import { StarknetAddressBigint } from "../interfaces";

export type SetViewingKeyInput = {
  random: bigint;
};

export type OpenChannelInput = {
  recipient_addr: StarknetAddressBigint;
  index: number;
  random: bigint;
  salt: bigint;
};

export type OpenSubchannelInput = {
  recipient_addr: StarknetAddressBigint;
  recipient_public_key: bigint;
  channel_key: bigint;
  index: number;
  token: StarknetAddressBigint;
  salt: bigint;
};

export type CreateEncNoteInput = {
  recipient_addr: StarknetAddressBigint;
  recipient_public_key: bigint;
  token: StarknetAddressBigint;
  amount: bigint;
  index: number;
  salt: bigint;
};

export type CreateOpenNoteInput = {
  recipient_addr: StarknetAddressBigint;
  recipient_public_key: bigint;
  token: StarknetAddressBigint;
  index: number;
  random: bigint;
};

export type DepositInput = {
  token: StarknetAddressBigint;
  amount: bigint;
};

export type UseNoteInput = {
  channel_key: bigint;
  token: StarknetAddressBigint;
  index: number;
};

export type WithdrawInput = {
  to_addr: StarknetAddressBigint;
  token: StarknetAddressBigint;
  amount: bigint;
  random: bigint;
};

export type InvokeExternalInput = {
  contract_address: StarknetAddressBigint;
  calldata: unknown;
};

export type ComputeAndInvokeInput = {
  contract_address: StarknetAddressBigint;
  compute_additional_data: unknown;
  invoke_additional_data: unknown;
};

/**
 * Union of all client actions.
 */
export type ClientAction =
  | { type: "SetViewingKey"; input: SetViewingKeyInput }
  | { type: "OpenChannel"; input: OpenChannelInput }
  | { type: "OpenSubchannel"; input: OpenSubchannelInput }
  | { type: "CreateEncNote"; input: CreateEncNoteInput }
  | { type: "CreateOpenNote"; input: CreateOpenNoteInput }
  | { type: "Deposit"; input: DepositInput }
  | { type: "UseNote"; input: UseNoteInput }
  | { type: "Withdraw"; input: WithdrawInput }
  | { type: "InvokeExternal"; input: InvokeExternalInput }
  | { type: "ComputeAndInvoke"; input: ComputeAndInvokeInput };

/** All valid client action type names */
export const CLIENT_ACTION_TYPES = [
  "SetViewingKey",
  "OpenChannel",
  "OpenSubchannel",
  "CreateEncNote",
  "CreateOpenNote",
  "Deposit",
  "UseNote",
  "Withdraw",
  "InvokeExternal",
  "ComputeAndInvoke",
] as const;

export type ClientActionType = (typeof CLIENT_ACTION_TYPES)[number];
