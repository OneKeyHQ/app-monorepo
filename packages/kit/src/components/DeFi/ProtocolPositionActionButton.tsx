import { type ComponentProps, memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import {
  EDeFiPositionAction,
  type IDeFiAsset,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
  type IDeFiUnknownRecord,
} from '@onekeyhq/shared/types/defi';

import {
  type IProtocolPositionActionSuccessParams,
  getActionLabel,
  showProtocolPositionActionDialog,
  useProtocolPositionActionSubmit,
} from './ProtocolPositionActionDialog';

type IProtocolPositionActionButtonProps = {
  accountId?: string;
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
  containerProps?: Omit<ComponentProps<typeof XStack>, 'children'>;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

type IBorrowManageParams = {
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  providerLogoURI?: string;
};

function normalizeMatchValue(value?: string) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') ?? ''
  );
}

function isAaveProtocol(protocolId?: string) {
  const normalizedProtocolId = normalizeMatchValue(protocolId);
  return (
    normalizedProtocolId === 'aave_v3' ||
    normalizedProtocolId === 'aave_pool_v3'
  );
}

function isPositiveAmount(amount?: string) {
  if (!amount) return false;
  const value = new BigNumber(amount);
  return value.isFinite() && value.gt(0);
}

function asRecord(value: unknown): IDeFiUnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as IDeFiUnknownRecord;
}

function pickStringFromRecord(
  record: IDeFiUnknownRecord | undefined,
  keys: string[],
) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function pickStringFromSources(sources: unknown[], keys: string[]) {
  for (const source of sources) {
    const record = asRecord(source);
    const value = pickStringFromRecord(record, keys);
    if (value) return value;

    for (const nestedKey of ['extraParams', 'contracts', 'meta']) {
      const nestedValue = pickStringFromRecord(
        asRecord(record?.[nestedKey]),
        keys,
      );
      if (nestedValue) return nestedValue;
    }
  }
  return undefined;
}

function getActionPositionSources(
  position: IDeFiProtocol['positions'][number],
) {
  const sourcePositions = position.sourcePositions ?? [];
  const assets = [
    ...position.assets,
    ...position.debts,
    ...sourcePositions.flatMap((sourcePosition) => sourcePosition.assets),
    ...sourcePositions.flatMap((sourcePosition) => sourcePosition.debts),
  ];
  return [position, ...sourcePositions, ...assets];
}

function hasDebt(position: IDeFiProtocol['positions'][number]) {
  return (
    position.debts.some((debt) => isPositiveAmount(debt.amount)) ||
    (position.sourcePositions?.some((sourcePosition) =>
      sourcePosition.debts.some((debt) => isPositiveAmount(debt.amount)),
    ) ??
      false)
  );
}

function getPrimarySuppliedAsset(
  position: IDeFiProtocol['positions'][number],
): IDeFiAsset | undefined {
  return (
    position.assets.find((asset) => isPositiveAmount(asset.amount)) ??
    position.sourcePositions
      ?.flatMap((sourcePosition) => sourcePosition.assets)
      .find((asset) => isPositiveAmount(asset.amount))
  );
}

function normalizeBorrowProvider(provider?: string) {
  const normalizedProvider = normalizeMatchValue(provider);
  if (!normalizedProvider) return undefined;
  if (
    normalizedProvider === 'aave_v3' ||
    normalizedProvider === 'aave_pool_v3'
  ) {
    return 'aave';
  }
  return normalizedProvider;
}

function getAaveBorrowManageParams({
  protocol,
  position,
}: {
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
}): IBorrowManageParams | undefined {
  if (!isAaveProtocol(protocol.protocol) || !hasDebt(position)) {
    return undefined;
  }

  const primaryAsset = getPrimarySuppliedAsset(position);
  const sources = getActionPositionSources(position);
  const provider =
    normalizeBorrowProvider(
      pickStringFromSources(sources, [
        'borrowProvider',
        'borrow_provider',
        'provider',
        'providerName',
        'provider_name',
      ]),
    ) ?? normalizeBorrowProvider(protocol.protocol);
  const marketAddress = pickStringFromSources(sources, [
    'marketAddress',
    'market_address',
    'market',
    'poolAddress',
    'pool_address',
    'pool',
  ]);
  const reserveAddress =
    pickStringFromSources(sources, [
      'reserveAddress',
      'reserve_address',
      'reserve',
      'underlyingAddress',
      'underlying_address',
      'tokenAddress',
      'token_address',
    ]) ?? primaryAsset?.address;
  const symbol =
    pickStringFromSources([primaryAsset], ['symbol']) ??
    pickStringFromSources(sources, ['symbol']);
  if (!provider || !marketAddress || !reserveAddress || !symbol) {
    return undefined;
  }

  return {
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI: primaryAsset?.meta?.logoUrl,
    providerLogoURI: pickStringFromSources(sources, [
      'providerLogoURI',
      'providerLogoUrl',
      'provider_logo_uri',
      'provider_logo_url',
    ]),
  };
}

const ProtocolPositionActionButton = memo(
  ({
    accountId,
    protocol,
    position,
    supportedActions,
    containerProps,
    onSuccess,
  }: IProtocolPositionActionButtonProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const submitProtocolPositionAction = useProtocolPositionActionSubmit({
      accountId: accountId ?? '',
      networkId: protocol.networkId,
      onSuccess,
    });
    const isActionAccount =
      !!accountId &&
      !accountUtils.isWatchingAccount({ accountId }) &&
      !accountUtils.isUrlAccountFn({ accountId });
    const actions = useMemo(
      () =>
        isActionAccount
          ? defiActionUtils.resolveDeFiPositionActions({
              protocol,
              position,
              supportedActions,
            })
          : [],
      [isActionAccount, position, protocol, supportedActions],
    );
    const hasAaveDebt = useMemo(
      () => isAaveProtocol(protocol.protocol) && hasDebt(position),
      [position, protocol.protocol],
    );
    const borrowManageParams = useMemo(
      () => getAaveBorrowManageParams({ protocol, position }),
      [position, protocol],
    );
    const visibleActions = useMemo(
      () =>
        hasAaveDebt
          ? actions.filter(
              (action) => action.action !== EDeFiPositionAction.Withdraw,
            )
          : actions,
      [actions, hasAaveDebt],
    );
    const handleActionPress = useCallback(
      async (action: (typeof visibleActions)[number]) => {
        if (!accountId) {
          return;
        }

        const selectedAsset = action.assets[0];
        if (
          selectedAsset &&
          action.assets.length === 1 &&
          action.action !== EDeFiPositionAction.Withdraw &&
          action.action !== EDeFiPositionAction.RemoveLiquidity
        ) {
          try {
            await submitProtocolPositionAction({
              action,
              selectedAsset,
            });
          } catch {
            return;
          }
          return;
        }

        showProtocolPositionActionDialog({
          accountId,
          networkId: protocol.networkId,
          action,
          onSuccess,
        });
      },
      [accountId, onSuccess, protocol.networkId, submitProtocolPositionAction],
    );
    const handleManagePress = useCallback(() => {
      if (!accountId || !borrowManageParams) return;
      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId,
        networkId: protocol.networkId,
        provider: borrowManageParams.provider,
        marketAddress: borrowManageParams.marketAddress,
        reserveAddress: borrowManageParams.reserveAddress,
        symbol: borrowManageParams.symbol,
        logoURI: borrowManageParams.logoURI,
        providerLogoURI: borrowManageParams.providerLogoURI,
        type: EManagePositionType.Withdraw,
      });
    }, [accountId, borrowManageParams, navigation, protocol.networkId]);

    if (
      !isActionAccount ||
      (visibleActions.length === 0 && !borrowManageParams)
    ) {
      return null;
    }

    return (
      <XStack gap="$1.5" alignItems="center" flexShrink={0} {...containerProps}>
        {visibleActions.map((action) => (
          <Button
            key={`${action.action}-${action.assetCategory ?? ''}-${
              action.rewardCategory ?? ''
            }`}
            testID={`defi-position-action-${action.action}`}
            size="small"
            variant="primary"
            onPress={() => void handleActionPress(action)}
          >
            {getActionLabel({ action: action.action, intl })}
          </Button>
        ))}
        {borrowManageParams ? (
          <Button
            testID="defi-position-action-manage"
            size="small"
            variant="primary"
            onPress={handleManagePress}
          >
            {intl.formatMessage({ id: ETranslations.global_manage })}
          </Button>
        ) : null}
      </XStack>
    );
  },
);

ProtocolPositionActionButton.displayName = 'ProtocolPositionActionButton';

export { ProtocolPositionActionButton };
