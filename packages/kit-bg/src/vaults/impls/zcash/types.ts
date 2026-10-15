import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type {
  IZcashSpendSource,
  IZcashTransparentOutpoint,
  IZcashTransparentTxBuildResult,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

// PCZT-based Zcash transaction. Structurally extends IEncodedTxBtc so the
// BTC-vault inheritance and the IEncodedTx union stay type-compatible
// (inputs/outputs carry the display intent; coin-select fields stay empty —
// note selection happens inside the wasm wallet, not in the app). The PCZT is
// created/proved by the watch-only wallet in the carrier and signed by the
// keys wasm.
export type IEncodedTxZcash = IEncodedTxBtc & {
  zcashMode: 'transparent' | 'privacy';
  zcashIsMaxSend?: boolean;
  zcashTo: string; // t1/t3 transparent or u1 unified
  zcashAmountValue: string; // zatoshi
  zcashMemoHex?: string;
  // Per-pool withdraw: note selection limited to this pool (see createPczt).
  // Unset for the shield sweep, which builds as a transparent transaction
  // through the stateless keys runtime.
  zcashSpendSource?: IZcashSpendSource;
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

export default {};
