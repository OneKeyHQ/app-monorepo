import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';

// Networks whose Aave market ships a WrappedTokenGateway the backend serves
// (native reserveAddress === '' rows + gateway deposit/withdraw/borrow/repay
// builds). Keep in sync with server coverage: a network missing here hides
// the user's existing native positions from withdraw/collateral flows.
export function shouldUseAaveNativeGateway({
  networkId,
  providerName,
  reserveAddress,
}: {
  networkId?: string;
  providerName?: string;
  reserveAddress?: string;
}) {
  const networkIdsMap = getNetworkIdsMap();
  return (
    (networkId === networkIdsMap.eth ||
      networkId === networkIdsMap.base ||
      networkId === networkIdsMap.arbitrum) &&
    providerName?.toLowerCase() === EBorrowProviderEnum.Aave &&
    reserveAddress === ''
  );
}

export function isAaveBorrowProvider({
  providerName,
}: {
  providerName?: string;
}) {
  return providerName?.toLowerCase() === EBorrowProviderEnum.Aave;
}

export function isUnsupportedAaveNativeReserve({
  networkId,
  providerName,
  reserveAddress,
}: {
  networkId?: string;
  providerName?: string;
  reserveAddress?: string;
}) {
  return (
    reserveAddress === '' &&
    isAaveBorrowProvider({ providerName }) &&
    !shouldUseAaveNativeGateway({ networkId, providerName, reserveAddress })
  );
}

export function filterUnsupportedAaveNativeReserveAssets<
  T extends { reserveAddress: string },
>({
  assets,
  networkId,
  providerName,
}: {
  assets?: T[];
  networkId?: string;
  providerName?: string;
}) {
  return (assets ?? []).filter(
    (asset) =>
      !isUnsupportedAaveNativeReserve({
        networkId,
        providerName,
        reserveAddress: asset.reserveAddress,
      }),
  );
}
