import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EPerpPageEnterSource,
  IPerpAccountStatusParams,
} from '@onekeyhq/shared/src/logger/scopes/perp/type';
import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

type IBuildPerpAccountStatusAnalyticsParams = {
  source: EPerpPageEnterSource;
  walletType: string;
  accountStatus: IPerpsActiveAccountStatusAtom;
  selectAccountLoading: boolean;
  accountCreationPending: boolean;
  computedAccountValue: {
    accountValue?: string;
    withdrawable?: string;
    isLoading: boolean;
  };
  positionsState: {
    accountAddress?: string;
    activePositions: unknown[];
  };
  abstractionMode?: {
    accountAddress?: string;
    mode?: EHyperLiquidAbstractionMode;
    source?: 'live' | 'cache';
  };
};

export function buildPerpAccountStatusAnalyticsParams({
  source,
  walletType,
  accountStatus,
  selectAccountLoading,
  accountCreationPending,
  computedAccountValue,
  positionsState,
  abstractionMode,
}: IBuildPerpAccountStatusAnalyticsParams):
  | IPerpAccountStatusParams
  | undefined {
  if (selectAccountLoading || accountCreationPending) {
    return undefined;
  }
  const baseParams = {
    source,
    walletType,
    isTradingEnabled: false,
  };
  if (accountStatus.accountNotSupport) {
    return { ...baseParams, snapshotStatus: 'unsupported' };
  }
  if (accountStatus.canCreateAddress) {
    return {
      ...baseParams,
      snapshotStatus: 'notCreated',
      isActivated: false,
      accountValue: 0,
      withdrawable: 0,
      positionCount: 0,
    };
  }

  const accountAddress = normalizePerpsAccountAddress(
    accountStatus.accountAddress,
  );
  const details = accountStatus.details;
  if (!accountAddress || !details || details.activatedOk === undefined) {
    return undefined;
  }

  const isActivated = details.activatedOk === true;
  const positionsAddress = normalizePerpsAccountAddress(
    positionsState.accountAddress,
  );
  const modeAddress = normalizePerpsAccountAddress(
    abstractionMode?.accountAddress,
  );
  const liveAccountMode =
    abstractionMode?.source !== 'cache' && modeAddress === accountAddress
      ? abstractionMode?.mode
      : undefined;
  if (
    isActivated &&
    (computedAccountValue.isLoading ||
      positionsAddress !== accountAddress ||
      !liveAccountMode)
  ) {
    return undefined;
  }

  const accountValue = isActivated
    ? Number(computedAccountValue.accountValue)
    : 0;
  const withdrawable = isActivated
    ? Number(computedAccountValue.withdrawable)
    : 0;
  if (!Number.isFinite(accountValue)) {
    return undefined;
  }

  const accountMode = isActivated ? liveAccountMode : undefined;
  const abstractionOk = accountMode
    ? accountMode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
      accountMode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN
    : details.abstractionOk;
  const positionCount = isActivated ? positionsState.activePositions.length : 0;
  return {
    source,
    walletType,
    snapshotStatus: 'ready',
    isTradingEnabled: accountStatus.canTrade === true,
    isActivated,
    agentOk: details.agentOk,
    builderFeeOk: details.builderFeeOk,
    referralCodeOk: details.referralCodeOk,
    abstractionOk,
    accountMode: isActivated ? accountMode : undefined,
    accountValue,
    withdrawable: Number.isFinite(withdrawable) ? withdrawable : undefined,
    positionCount,
  };
}
