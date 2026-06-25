import {
  type ComponentProps,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import {
  EDeFiPositionAction,
  type IDeFiAsset,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
  type IDeFiUnknownRecord,
  type IResolvedDeFiPositionAction,
} from '@onekeyhq/shared/types/defi';

import {
  type IProtocolPositionActionSuccessParams,
  getActionLabel,
  showProtocolPositionActionDialog,
  useProtocolPositionActionSubmit,
} from './ProtocolPositionActionDialog';

type IProtocolPositionActionButtonProps = {
  accountId?: string;
  indexedAccountId?: string;
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol' | 'indexedAccountId'>;
  position: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
  placement?: 'all' | 'balance' | 'rewards' | 'debt';
  // The specific asset this button acts on. When set, the manage
  // (Withdraw/Repay) action targets this asset's own reserve instead of the
  // position's primary supplied asset, so each supplied/borrowed row gets a
  // correctly-scoped button.
  manageAsset?: IDeFiAsset;
  // Resolved protocol actions (Withdraw/Claim/Remove) are position-level, so a
  // per-asset caller renders them once (e.g. on the first asset) and sets this
  // false on the rest to avoid repeating them under every row.
  showResolvedActions?: boolean;
  visualVariant?: 'solid' | 'info';
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

type IRenderedDeFiPositionAction = IResolvedDeFiPositionAction & {
  disabled?: boolean;
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
  manageAsset,
}: {
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  manageAsset?: IDeFiAsset;
}): IBorrowManageParams | undefined {
  if (!isAaveProtocol(protocol.protocol) || !hasDebt(position)) {
    return undefined;
  }

  const primaryAsset = getPrimarySuppliedAsset(position);
  // The asset this button acts on: the caller-scoped asset for per-asset
  // Withdraw/Repay, otherwise the position's primary supplied asset.
  const targetAsset = manageAsset ?? primaryAsset;
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
  // A scoped asset IS the reserve target, so its own address/symbol win. We
  // still prefer an explicit reserve/underlying field off the asset's own
  // record when present, falling back to its address — this guards against a
  // provider that ever emits a wrapper (aToken/variableDebtToken) in `.address`
  // instead of the underlying reserve.
  const reserveAddress = manageAsset
    ? (pickStringFromSources(
        [manageAsset],
        [
          'reserveAddress',
          'reserve_address',
          'reserve',
          'underlyingAddress',
          'underlying_address',
        ],
      ) ?? manageAsset.address)
    : (pickStringFromSources(sources, [
        'reserveAddress',
        'reserve_address',
        'reserve',
        'underlyingAddress',
        'underlying_address',
        'tokenAddress',
        'token_address',
      ]) ?? primaryAsset?.address);
  const symbol = manageAsset
    ? manageAsset.symbol
    : (pickStringFromSources([primaryAsset], ['symbol']) ??
      pickStringFromSources(sources, ['symbol']));
  if (!provider || !marketAddress || !reserveAddress || !symbol) {
    return undefined;
  }

  return {
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI: targetAsset?.meta?.logoUrl,
    providerLogoURI: pickStringFromSources(sources, [
      'providerLogoURI',
      'providerLogoUrl',
      'provider_logo_uri',
      'provider_logo_url',
    ]),
  };
}

function getResolvedActionKey(action: IResolvedDeFiPositionAction) {
  return [
    action.protocolId,
    action.networkId,
    action.positionCategory,
    action.assetCategory ?? '',
    action.debtCategory ?? '',
    action.rewardCategory ?? '',
    action.action,
  ].join('-');
}

function isBalancePlacementAction(action: EDeFiPositionAction) {
  return (
    action === EDeFiPositionAction.Withdraw ||
    action === EDeFiPositionAction.ClaimWithdrawal ||
    action === EDeFiPositionAction.RemoveLiquidity
  );
}

function isRewardsPlacementAction(action: EDeFiPositionAction) {
  return action === EDeFiPositionAction.Claim;
}

function isDebtPlacementAction(action: EDeFiPositionAction) {
  return action === EDeFiPositionAction.Repay;
}

function isVisibleInPlacement({
  action,
  placement,
}: {
  action: EDeFiPositionAction;
  placement: NonNullable<IProtocolPositionActionButtonProps['placement']>;
}) {
  if (placement === 'all') return true;
  if (placement === 'balance') return isBalancePlacementAction(action);
  if (placement === 'rewards') return isRewardsPlacementAction(action);
  if (placement === 'debt') return isDebtPlacementAction(action);
  return false;
}

function getVisibleDeFiPositionActions<
  T extends { action: EDeFiPositionAction },
>({
  actions,
  placement,
}: {
  actions: T[];
  placement: NonNullable<IProtocolPositionActionButtonProps['placement']>;
}) {
  return actions.filter((action) =>
    isVisibleInPlacement({ action: action.action, placement }),
  );
}

function getManageActionTypeAction(type: EManagePositionType) {
  if (type === EManagePositionType.Repay) {
    return EDeFiPositionAction.Repay;
  }
  return EDeFiPositionAction.Withdraw;
}

// Manage actions sit under the asset they act on, like the other inline
// actions: Withdraw with the supplied balance, Repay with the borrowed debt.
function getManageActionTypesForPlacement(
  placement: NonNullable<IProtocolPositionActionButtonProps['placement']>,
): EManagePositionType[] {
  const types: EManagePositionType[] = [];
  if (placement === 'all' || placement === 'balance') {
    types.push(EManagePositionType.Withdraw);
  }
  if (placement === 'all' || placement === 'debt') {
    types.push(EManagePositionType.Repay);
  }
  return types;
}

function getManageActionLabel({
  type,
  intl,
}: {
  type: EManagePositionType;
  intl: ReturnType<typeof useIntl>;
}) {
  if (type === EManagePositionType.Repay) {
    return intl.formatMessage({ id: ETranslations.defi_repay });
  }
  return intl.formatMessage({ id: ETranslations.global_withdraw });
}

const INFO_OUTLINE_BUTTON_PROPS = {
  variant: 'link',
  childrenAsText: false,
  px: '$1.5',
  py: '$0.5',
  borderRadius: '$2',
  borderWidth: '$px',
  borderColor: '$borderInfoSubdued',
  bg: '$transparent',
  hoverStyle: { bg: '$bgInfoSubdued', borderColor: '$borderInfo' },
  pressStyle: { bg: '$bgInfo', borderColor: '$borderInfo' },
} as const;

const SOLID_BUTTON_PROPS = {
  variant: 'primary',
} as const;

function getActionButtonFrameProps(isInfo: boolean) {
  return isInfo ? INFO_OUTLINE_BUTTON_PROPS : SOLID_BUTTON_PROPS;
}

function renderActionButtonLabel({
  isInfo,
  label,
}: {
  isInfo: boolean;
  label: string;
}) {
  if (!isInfo) return label;
  return (
    <SizableText size="$bodySmMedium" color="$textInfo">
      {label}
    </SizableText>
  );
}

const ProtocolPositionActionButton = memo(
  ({
    accountId,
    indexedAccountId,
    protocol,
    position,
    supportedActions,
    placement = 'all',
    manageAsset,
    showResolvedActions = true,
    visualVariant = 'solid',
    containerProps,
    onSuccess,
  }: IProtocolPositionActionButtonProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const [devSettings] = useDevSettingsPersistAtom();
    const submitProtocolPositionAction = useProtocolPositionActionSubmit({
      accountId: accountId ?? '',
      networkId: protocol.networkId,
      onSuccess,
    });
    const submittingActionKeyRef = useRef<string | undefined>(undefined);
    const [submittingActionKey, setSubmittingActionKey] = useState<
      string | undefined
    >(undefined);
    const isActionAccount =
      !!accountId &&
      !accountUtils.isUrlAccountFn({ accountId }) &&
      !accountUtils.isWatchingAccount({ accountId });
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
    const shouldShowUnavailableDeFiActionButtons = Boolean(
      devSettings.enabled &&
      devSettings.settings?.showUnavailableDeFiActionButtons,
    );
    const unavailableActions = useMemo<IRenderedDeFiPositionAction[]>(
      () =>
        isActionAccount && shouldShowUnavailableDeFiActionButtons
          ? defiActionUtils
              .resolveDeFiPositionActionDebugCandidates({
                protocol,
                position,
                supportedActions,
              })
              .map((action) => ({ ...action, disabled: true }))
          : [],
      [
        isActionAccount,
        position,
        protocol,
        shouldShowUnavailableDeFiActionButtons,
        supportedActions,
      ],
    );
    const hasAaveDebt = useMemo(
      () => isAaveProtocol(protocol.protocol) && hasDebt(position),
      [position, protocol.protocol],
    );
    const borrowManageParams = useMemo(
      () => getAaveBorrowManageParams({ protocol, position, manageAsset }),
      [manageAsset, position, protocol],
    );
    const fallbackBlockingActions = useMemo(
      () => (isActionAccount ? [...actions, ...unavailableActions] : []),
      [actions, isActionAccount, unavailableActions],
    );
    const visibleActions = useMemo(
      () =>
        getVisibleDeFiPositionActions({
          actions,
          placement,
        }),
      [actions, placement],
    );
    const visibleUnavailableActions = useMemo(
      () =>
        getVisibleDeFiPositionActions({
          actions: unavailableActions,
          placement,
        }),
      [placement, unavailableActions],
    );
    const deFiManageActions = useMemo(
      () =>
        new Set(
          getVisibleDeFiPositionActions({
            actions: fallbackBlockingActions,
            placement,
          }).map((action) => action.action),
        ),
      [fallbackBlockingActions, placement],
    );
    const manageActionTypes = getManageActionTypesForPlacement(
      placement,
    ).filter(
      (manageType) =>
        !deFiManageActions.has(getManageActionTypeAction(manageType)),
    );
    const shouldShowManage =
      hasAaveDebt &&
      manageActionTypes.length > 0 &&
      Boolean(borrowManageParams);
    // Position-level resolved actions render once per position; a per-asset
    // caller suppresses them on every row but the first.
    const renderedActions: IRenderedDeFiPositionAction[] = showResolvedActions
      ? [...visibleActions, ...visibleUnavailableActions]
      : [];
    const handleActionPress = useCallback(
      async (action: IRenderedDeFiPositionAction) => {
        if (action.disabled) {
          return;
        }
        if (!accountId) {
          return;
        }
        if (submittingActionKeyRef.current) {
          return;
        }

        const selectedAsset = action.assets[0];
        if (
          selectedAsset &&
          action.assets.length === 1 &&
          action.action !== EDeFiPositionAction.Withdraw &&
          action.action !== EDeFiPositionAction.Repay &&
          action.action !== EDeFiPositionAction.RemoveLiquidity
        ) {
          const actionKey = getResolvedActionKey(action);
          submittingActionKeyRef.current = actionKey;
          setSubmittingActionKey(actionKey);
          try {
            await submitProtocolPositionAction({
              action,
              selectedAssets: [selectedAsset],
            });
          } catch {
            return;
          } finally {
            submittingActionKeyRef.current = undefined;
            setSubmittingActionKey(undefined);
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
    const handleManagePress = useCallback(
      (type: EManagePositionType) => {
        if (!accountId || !borrowManageParams) return;
        BorrowNavigation.pushToBorrowManagePosition(navigation, {
          accountId,
          indexedAccountId: protocol.indexedAccountId ?? indexedAccountId,
          networkId: protocol.networkId,
          provider: borrowManageParams.provider,
          marketAddress: borrowManageParams.marketAddress,
          reserveAddress: borrowManageParams.reserveAddress,
          symbol: borrowManageParams.symbol,
          logoURI: borrowManageParams.logoURI,
          providerLogoURI: borrowManageParams.providerLogoURI,
          type,
        });
      },
      [
        accountId,
        borrowManageParams,
        indexedAccountId,
        navigation,
        protocol.indexedAccountId,
        protocol.networkId,
      ],
    );

    if (
      !isActionAccount ||
      (renderedActions.length === 0 && !shouldShowManage)
    ) {
      return null;
    }

    const isInfo = visualVariant === 'info';
    const actionButtonFrameProps = getActionButtonFrameProps(isInfo);

    return (
      <XStack
        gap={isInfo ? '$1' : '$1.5'}
        alignItems="center"
        justifyContent={isInfo ? 'flex-start' : 'flex-end'}
        flexShrink={1}
        flexWrap="wrap"
        minWidth={0}
        {...containerProps}
      >
        {renderedActions.map((action) => {
          const actionKey = getResolvedActionKey(action);
          const isActionDisabled =
            action.disabled || Boolean(submittingActionKey);
          return (
            <Button
              key={actionKey}
              testID={`defi-position-action-${action.action}`}
              size="small"
              {...actionButtonFrameProps}
              disabled={isActionDisabled}
              loading={!action.disabled && submittingActionKey === actionKey}
              onPress={() => void handleActionPress(action)}
            >
              {renderActionButtonLabel({
                isInfo,
                label: getActionLabel({ action: action.action, intl }),
              })}
            </Button>
          );
        })}
        {shouldShowManage
          ? manageActionTypes.map((manageType) => (
              <Button
                key={manageType}
                testID={`defi-position-action-manage-${manageType}`}
                size="small"
                {...actionButtonFrameProps}
                disabled={Boolean(submittingActionKey)}
                onPress={() => handleManagePress(manageType)}
              >
                {renderActionButtonLabel({
                  isInfo,
                  label: getManageActionLabel({ type: manageType, intl }),
                })}
              </Button>
            ))
          : null}
      </XStack>
    );
  },
);

ProtocolPositionActionButton.displayName = 'ProtocolPositionActionButton';

export { ProtocolPositionActionButton };
