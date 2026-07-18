// cspell: words unifold Unifold
import type { DepositConfig } from '@unifold/connect-react-native';

// Platform-neutral handle store. The RN SDK exposes beginDeposit only through
// its provider context, while our deposit entry points are imperative calls.
// PerpsUnifoldDepositHost.native.tsx writes the hook value here and
// PerpsUnifoldDepositModal.native.tsx reads it; keeping the handle in this
// suffix-free module avoids .native-only exports that the standard TypeScript
// resolver (which ignores metro platform suffixes) cannot see.
// The import above is type-only, so no native SDK code reaches web bundles.
export type IUnifoldNativeBeginDeposit = (
  config: DepositConfig,
) => Promise<unknown>;

let nativeBeginDeposit: IUnifoldNativeBeginDeposit | undefined;

export function setNativeUnifoldBeginDeposit(
  handle: IUnifoldNativeBeginDeposit | undefined,
) {
  nativeBeginDeposit = handle;
}

export function getNativeUnifoldBeginDeposit():
  | IUnifoldNativeBeginDeposit
  | undefined {
  return nativeBeginDeposit;
}
