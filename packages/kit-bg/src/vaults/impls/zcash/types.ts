import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type {
  IZcashSpendSource,
  IZcashTransparentOutpoint,
  IZcashTransparentTxBuildResult,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

// PCZT-based Zcash transaction. Structurally extends IEncodedTxBtc so the
// BTC-vault inheritance and the IEncodedTx union stay type-compatible
// (inputs/outputs carry the display intent; coin-select fields stay empty —
// note selection happens inside the wasm wallet, not in the app). The PCZT is
// created/proved by the watch-only wallet in the carrier and signed by the
// keys wasm.
export type IEncodedTxZcash = IEncodedTxBtc & {
  // Missing on development-era PCZT transactions; those remain privacy txs.
  zcashMode?: 'transparent' | 'privacy';
  zcashTo: string; // t1/t3 transparent or u1 unified
  zcashAmountValue: string; // zatoshi
  // Shield sweep (transparent -> own shielded pool): create goes through
  // pcztShield instead of pcztCreate; amount is display intent only (the
  // sweep proposer takes no amount and deducts the fee itself).
  isShielding?: boolean;
  zcashShieldingGrossValue?: string; // zatoshi before the exact ZIP-317 fee
  // Per-pool withdraw: note selection limited to this pool (see createPczt).
  zcashSpendSource?: IZcashSpendSource;
  // Account preference captured when this transaction is built. Keeping it on
  // the encoded transaction makes fee quote and PCZT creation use one policy.
  zcashSpendTransparent?: boolean;
  // Unsigned PCZT built at buildUnsignedTx (inputs locked, fee exact). Every
  // keyring -- software or hardware -- signs this same object.
  pcztHex?: string;
  signedPcztHex?: string; // filled by the keyring after prove+sign
  pcztReservationId?: string; // input-lock owner, carried until broadcast
  zcashTransparentPlan?: {
    ownerId: string;
    accountIndex: number;
    sendMax: boolean;
    selectedOutpoints: IZcashTransparentOutpoint[];
    change?: { address: string; derivationPath: string };
  };
  // Exact signed result retained for durable pending/unknown reconciliation.
  // The SimpleDB journal owns persistence; the stateless keys runtime does not.
  zcashTransparentBuild?: IZcashTransparentTxBuildResult;
};

// Typed slice of the zcash Vault's PCZT methods for the keyrings (type-only,
// avoids the Vault <-> Keyring circular value import). The PCZT itself is
// created by the vault at build time; a keyring only proves, signs and
// commits it, so a hardware keyring runs the identical steps with the device
// as the signer.
export type IZcashVaultPcztApi = {
  // Verifies the reservation is still live and returns the proved PCZT
  // (software signer: prove, then sign).
  zcashPreparePcztForSigning: (params: {
    accountId: string;
    reservationId: string;
    pcztHex: string;
  }) => Promise<{ pcztHex: string }>;
  // Hardware signer: sign the unproved PCZT on the device, merge, then prove.
  zcashAssertPcztReservationLive: (params: {
    accountId: string;
    reservationId: string;
  }) => Promise<void>;
  zcashCombineSignedPczt: (params: {
    accountId: string;
    originalPcztHex: string;
    signedPcztHex: string;
  }) => Promise<{ pcztHex: string }>;
  zcashProvePczt: (params: {
    accountId: string;
    pcztHex: string;
  }) => Promise<{ pcztHex: string }>;
  // Marks the reservation as carrying a signed transaction (blocks new sends
  // until broadcast or expiry).
  zcashCommitSignedPczt: (params: {
    accountId: string;
    reservationId: string;
  }) => Promise<void>;
  // Unlocks the inputs and drops the journal entry.
  zcashAbandonPczt: (params: {
    accountId: string;
    reservationId: string;
  }) => Promise<void>;
};

export type IZcashVaultTransparentApi = {
  zcashPrepareFreshTransparentRequest: (params: {
    encodedTx: IEncodedTxZcash;
  }) => Promise<IZcashTransparentTxRequest>;
};

export default {};
