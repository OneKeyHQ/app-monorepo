// These values are part of the hardware message wire protocol. Keeping the
// small constants here avoids eagerly loading hd-transport and its protobuf
// runtime when callers only need an enum value.
export const HARDWARE_CARDANO_ADDRESS_TYPE = {
  BASE: 0,
  BASE_SCRIPT_KEY: 1,
  BASE_KEY_SCRIPT: 2,
  BASE_SCRIPT_SCRIPT: 3,
  POINTER: 4,
  POINTER_SCRIPT: 5,
  ENTERPRISE: 6,
  ENTERPRISE_SCRIPT: 7,
  BYRON: 8,
  REWARD: 14,
  REWARD_SCRIPT: 15,
} as const;

export const HARDWARE_RESOURCE_TYPE = {
  WallPaper: 0,
  Nft: 1,
} as const;

export const HARDWARE_TON_WALLET_VERSION = {
  V4R2: 3,
} as const;
