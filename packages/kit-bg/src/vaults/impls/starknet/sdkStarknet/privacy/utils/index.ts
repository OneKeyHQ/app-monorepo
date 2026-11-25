// Re-export all utilities

export { jsonStringify, jsonParse } from "./json";
export {
  withLogging,
  consoleLogCallback,
  noopLogCallback,
  isDebugEnabled,
  debugHint,
  DEBUG_ENV_VAR,
  type LogCallback,
} from "./logging";
export { AdvancedMap, AddressMap } from "./maps";
export { assert, assertViewingKey, assertRecipientAddress, isOpen } from "./validation";
export {
  hash,
  shortStringToFelt,
  derivePublicKey,
  encryptSymmetric,
  decryptSymmetric,
  type Hash,
  type ChannelKey,
  type PublicKey,
  type PrivateKey,
  type SymmetricEncryption,
} from "./crypto";
export {
  compute_channel_key,
  compute_channel_marker,
  compute_subchannel_id,
  compute_subchannel_marker,
  compute_note_id,
  compute_nullifier,
  compute_enc_amount_hash,
  compute_enc_token_hash,
  compute_enc_private_key_hash,
  compute_enc_user_addr_hash,
  compute_enc_channel_key_hash,
  compute_enc_sender_addr_hash,
} from "./hashes";
export { encryptions, type EncSubchannelInfo, type SubchannelInfo } from "./encryptions";
export {
  decodeError,
  decodeValue,
  hexToString,
  lookupSelector,
  addSelectors,
  type DecodedError,
} from "./error-decoder";
export { toBigInt, toBytes, toHex, type Numeric } from "./convert";
export { buildProofFacts } from "./proof-facts";
