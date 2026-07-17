import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  XStack,
  useInPageDialog,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EDeFiPositionAction,
  type IDeFiAsset,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
  type IDeFiUnknownRecord,
  type IResolvedDeFiPositionAction,
} from '@onekeyhq/shared/types/defi';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import {
  type IProtocolLendingActionType,
  showProtocolLendingActionDialog,
} from './ProtocolLendingActionDialog';
import { findSupportedBorrowMarket } from './protocolLendingActionUtils';
import {
  type IProtocolPositionActionSuccessParams,
  getActionLabel,
  showProtocolPositionActionDialog,
  useProtocolPositionActionSubmit,
} from './ProtocolPositionActionDialog';

export type IProtocolPositionProviderDisplayInfo = {
  providerDisplayName?: string;
  providerLogoURI?: string;
};

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
  providerDisplayInfo?: IProtocolPositionProviderDisplayInfo;
  // Resolved protocol actions (Withdraw/Claim/Remove) are position-level, so a
  // per-asset caller renders them once (e.g. on the first asset) and sets this
  // false on the rest to avoid repeating them under every row.
  showResolvedActions?: boolean;
  visualVariant?: 'solid' | 'info';
  // Render the actions as full-width buttons stacked below the position
  // (unified/simple layout) instead of inline chips. Two actions split the row.
  block?: boolean;
  // Sectioned (lending) block callers route Withdraw/Repay through the lending
  // action dialog (asset dropdown + amount hero) instead of the generic action
  // dialog. Only the mobile block caller sets this; desktop tables and
  // non-sectioned positions keep the generic path.
  preferLendingDialog?: boolean;
  // Floor width (px) for each inline action button so per-asset rows align
  // Withdraw/Repay/Claim into one column. A minimum, not a cap — a longer
  // localized label still grows rather than truncating.
  actionMinWidth?: number;
  containerProps?: Omit<ComponentProps<typeof XStack>, 'children'>;
  actionPresentation?: 'dialog' | 'modal-route';
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

type IBorrowManageParams = {
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  debtAmount?: string;
  logoURI?: string;
  providerDisplayName?: string;
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

function getPrimaryDebtAsset(
  position: IDeFiProtocol['positions'][number],
): IDeFiAsset | undefined {
  return (
    position.debts.find((debt) => isPositiveAmount(debt.amount)) ??
    position.sourcePositions
      ?.flatMap((sourcePosition) => sourcePosition.debts)
      .find((debt) => isPositiveAmount(debt.amount))
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
  providerDisplayInfo,
  actionType,
  markets,
}: {
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  manageAsset?: IDeFiAsset;
  providerDisplayInfo?: IProtocolPositionProviderDisplayInfo;
  actionType: 'withdraw' | 'repay';
  markets: IBorrowMarketItem[] | undefined;
}): IBorrowManageParams | undefined {
  if (
    !isAaveProtocol(protocol.protocol) ||
    !defiActionUtils.positionHasDebts(position)
  ) {
    return undefined;
  }

  // Repay anchors on the primary debt (the loan being paid down); withdraw on
  // the primary supplied collateral. A caller-scoped asset still wins below.
  const primaryAsset =
    actionType === 'repay'
      ? (getPrimaryDebtAsset(position) ?? getPrimarySuppliedAsset(position))
      : getPrimarySuppliedAsset(position);
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
  // Prefer an explicit reserve/underlying field off the target asset's own
  // record, falling back to its address — this guards against a provider that
  // ever emits a wrapper (aToken/variableDebtToken) in `.address` instead of
  // the underlying reserve.
  const assetReserveKeys = [
    'reserveAddress',
    'reserve_address',
    'reserve',
    'underlyingAddress',
    'underlying_address',
  ];
  // Anchor the reserve on the asset this action actually targets: the scoped
  // manageAsset, else the primary asset — collateral for withdraw, the debt
  // being repaid for repay. Trust that asset's own reserve field then its
  // address before falling back to a broad group scan; otherwise a repay could
  // latch onto a collateral/generic reserve that a supplied asset (scanned
  // before debts) happens to carry, mismatching the debt symbol resolved below.
  const reserveAddress = manageAsset
    ? (pickStringFromSources([manageAsset], assetReserveKeys) ??
      manageAsset.address)
    : (pickStringFromSources([primaryAsset], assetReserveKeys) ??
      primaryAsset?.address ??
      pickStringFromSources(sources, [
        ...assetReserveKeys,
        'tokenAddress',
        'token_address',
      ]));
  const symbol = manageAsset
    ? manageAsset.symbol
    : (pickStringFromSources([primaryAsset], ['symbol']) ??
      pickStringFromSources(sources, ['symbol']));
  if (!provider || !marketAddress || !reserveAddress || !symbol) {
    return undefined;
  }

  // Environment gate: only route into the /earn/v1/borrow/* stack when the
  // current environment's markets list actually supports this market.
  // Fail-closed — no whitelist match (including markets still loading or the
  // fetch having failed) keeps the generic DeFi action path.
  if (
    !findSupportedBorrowMarket({
      markets,
      provider,
      networkId: protocol.networkId,
      marketAddress,
    })
  ) {
    return undefined;
  }

  return {
    provider,
    marketAddress: earnUtils.normalizeBorrowAddress({
      networkId: protocol.networkId,
      address: marketAddress,
    }),
    reserveAddress: earnUtils.normalizeBorrowAddress({
      networkId: protocol.networkId,
      address: reserveAddress,
    }),
    symbol,
    debtAmount: actionType === 'repay' ? targetAsset?.amount : undefined,
    logoURI: targetAsset?.meta?.logoUrl,
    providerDisplayName:
      providerDisplayInfo?.providerDisplayName ||
      pickStringFromSources(sources, [
        'providerDisplayName',
        'provider_display_name',
        'protocolName',
        'protocol_name',
      ]),
    providerLogoURI:
      providerDisplayInfo?.providerLogoURI ||
      pickStringFromSources(sources, [
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

// Scope each action to the caller's asset so a per-asset row renders a button
// acting on just that token. Unscoped callers (manageAsset undefined) keep the
// full position-level action list unchanged.
function scopeActionsToManageAsset<T extends IResolvedDeFiPositionAction>(
  actions: T[],
  manageAsset: IDeFiAsset | undefined,
): T[] {
  if (!manageAsset) return actions;
  return actions.reduce<T[]>((acc, action) => {
    const scoped = defiActionUtils.scopeResolvedActionToAsset({
      action,
      tokenAddress: manageAsset.address,
    });
    if (scoped) acc.push(scoped);
    return acc;
  }, []);
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

// Full-width action(s) stacked below a position (the unified/simple layout):
// one button fills the row, two (e.g. Withdraw + Claim) split it evenly via
// flex. Same info-blue outline as the inline buttons, sized up.
const BLOCK_OUTLINE_BUTTON_PROPS = {
  variant: 'link',
  childrenAsText: false,
  flex: 1,
  py: '$3',
  borderRadius: '$3',
  borderWidth: '$px',
  borderColor: '$borderInfoSubdued',
  bg: '$transparent',
  hoverStyle: { bg: '$bgInfoSubdued', borderColor: '$borderInfo' },
  pressStyle: { bg: '$bgInfo', borderColor: '$borderInfo' },
} as const;

function getActionButtonFrameProps({
  isInfo,
  isBlock,
}: {
  isInfo: boolean;
  isBlock: boolean;
}) {
  if (isBlock) return BLOCK_OUTLINE_BUTTON_PROPS;
  return isInfo ? INFO_OUTLINE_BUTTON_PROPS : SOLID_BUTTON_PROPS;
}

function renderActionButtonLabel({
  isInfo,
  isBlock,
  label,
}: {
  isInfo: boolean;
  isBlock: boolean;
  label: string;
}) {
  if (!isInfo && !isBlock) return label;
  return (
    <SizableText
      size={isBlock ? '$bodyMdMedium' : '$bodySmMedium'}
      color="$textInfo"
      numberOfLines={1}
    >
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
    providerDisplayInfo,
    showResolvedActions = true,
    visualVariant = 'solid',
    block = false,
    preferLendingDialog = false,
    actionMinWidth,
    containerProps,
    actionPresentation = 'dialog',
    onSuccess,
  }: IProtocolPositionActionButtonProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const inPageDialog = useInPageDialog();
    const submitProtocolPositionAction = useProtocolPositionActionSubmit({
      accountId: accountId ?? '',
      networkId: protocol.networkId,
      onSuccess,
    });
    const submittingActionKeyRef = useRef<string | undefined>(undefined);
    const [submittingActionKey, setSubmittingActionKey] = useState<
      string | undefined
    >(undefined);
    const cancelPendingLendingDialogOpenRef = useRef<(() => void) | undefined>(
      undefined,
    );
    const shouldResolveActionButtons = !!accountId;
    const actions = useMemo(
      () =>
        shouldResolveActionButtons
          ? defiActionUtils.resolveDeFiPositionActions({
              protocol,
              position,
              supportedActions,
            })
          : [],
      [position, protocol, shouldResolveActionButtons, supportedActions],
    );
    const hasAaveDebt = useMemo(
      () =>
        isAaveProtocol(protocol.protocol) &&
        defiActionUtils.positionHasDebts(position),
      [position, protocol.protocol],
    );
    // Borrow-stack whitelist for the current environment. Only fetched for
    // Aave debt positions (the sole borrow-dialog entry); the service call is
    // promise-memoized so per-row instances share one request. initResult []
    // + error-keeps-last-result = fail-closed while loading or on error.
    const { result: borrowMarkets, isLoading: borrowMarketsLoading } =
      usePromiseResult(
        async () => {
          if (!hasAaveDebt) {
            return [];
          }
          try {
            return await backgroundApiProxy.serviceStaking.getBorrowMarkets();
          } catch {
            return [] as IBorrowMarketItem[];
          }
        },
        [hasAaveDebt],
        // Repo precedent for typed empty initResult: ProtocolLendingActionDialog
        // :692 (`assets: [] as IBorrowAsset[]`). Never let it infer never[].
        { initResult: [] as IBorrowMarketItem[], watchLoading: true },
      );
    // Removing an LP that holds rewards also claims them — drives the
    // "Remove" vs "Remove & Claim rewards" label.
    const hasRewards = useMemo(
      () => defiActionUtils.positionHasRewards(position),
      [position],
    );
    // Outstanding debt means withdrawing collateral raises liquidation risk;
    // the dialog shows a warning banner when this is set.
    const positionHasDebts = useMemo(
      () => defiActionUtils.positionHasDebts(position),
      [position],
    );
    // Withdraw and Repay resolve to different reserves (collateral vs debt), so
    // each manage type gets its own params object.
    const withdrawManageParams = useMemo(
      () =>
        getAaveBorrowManageParams({
          protocol,
          position,
          manageAsset,
          providerDisplayInfo,
          actionType: 'withdraw',
          markets: borrowMarkets,
        }),
      [manageAsset, position, protocol, providerDisplayInfo, borrowMarkets],
    );
    const repayManageParams = useMemo(
      () =>
        getAaveBorrowManageParams({
          protocol,
          position,
          manageAsset,
          providerDisplayInfo,
          actionType: 'repay',
          markets: borrowMarkets,
        }),
      [manageAsset, position, protocol, providerDisplayInfo, borrowMarkets],
    );
    const fallbackBlockingActions = useMemo(
      () => (shouldResolveActionButtons ? actions : []),
      [actions, shouldResolveActionButtons],
    );
    const visibleActions = useMemo(
      () =>
        getVisibleDeFiPositionActions({
          actions,
          placement,
        }),
      [actions, placement],
    );
    // Per-asset rows (manageAsset set) narrow each action to the row's own
    // token, so every supplied/borrowed row gets its own button.
    const scopedVisibleActions = useMemo(
      () => scopeActionsToManageAsset(visibleActions, manageAsset),
      [manageAsset, visibleActions],
    );
    const deFiManageActions = useMemo(
      () =>
        new Set(
          scopeActionsToManageAsset(
            getVisibleDeFiPositionActions({
              actions: fallbackBlockingActions,
              placement,
            }),
            manageAsset,
          ).map((action) => action.action),
        ),
      [fallbackBlockingActions, manageAsset, placement],
    );
    // Aave positions with debt route Withdraw (collateral) and Repay through the
    // lending action dialog (health factor / liquidation preview) instead of the
    // generic action dialog. This inverts the usual precedence, where a resolved
    // action would otherwise suppress the manage button. Falls back to the
    // generic dialog per-side when that side's borrow params can't resolve, so
    // no row loses its button.
    const preferManageForAave =
      hasAaveDebt &&
      (Boolean(withdrawManageParams) || Boolean(repayManageParams));
    const manageActionTypes = getManageActionTypesForPlacement(
      placement,
    ).filter(
      (manageType) =>
        Boolean(
          manageType === EManagePositionType.Repay
            ? repayManageParams
            : withdrawManageParams,
        ) &&
        (preferManageForAave ||
          !deFiManageActions.has(getManageActionTypeAction(manageType))),
    );
    const shouldShowManage = hasAaveDebt && manageActionTypes.length > 0;
    // A per-asset caller (manageAsset set) shows each row's own scoped action;
    // an unscoped caller keeps the position-level actions on the first row only.
    let renderedActions: IResolvedDeFiPositionAction[] = [];
    if (manageAsset) {
      renderedActions = scopedVisibleActions;
    } else if (showResolvedActions) {
      renderedActions = visibleActions;
    }
    // Aave Withdraw/Repay are owned by the manage button above, so drop the
    // generic resolved action — but only for the side whose manage button will
    // actually render. If that side's params didn't resolve, keep the resolved
    // action so the row never loses a button.
    if (preferManageForAave) {
      renderedActions = renderedActions.filter((action) => {
        if (action.action === EDeFiPositionAction.Withdraw) {
          return !withdrawManageParams;
        }
        if (action.action === EDeFiPositionAction.Repay) {
          return !repayManageParams;
        }
        return true;
      });
    }
    // While the borrow whitelist is still loading for an Aave debt position the
    // manage params haven't resolved, so preferManageForAave is false and the
    // generic Withdraw/Repay would (mis)route to the non-borrow dialog (no
    // health factor / liquidation preview). Hold those two back until markets
    // settle; the correct button (borrow or generic) then renders in place.
    // Claim/Remove are unaffected.
    if (hasAaveDebt && borrowMarketsLoading) {
      renderedActions = renderedActions.filter(
        (action) =>
          action.action !== EDeFiPositionAction.Withdraw &&
          action.action !== EDeFiPositionAction.Repay,
      );
    }
    useEffect(
      () => () => {
        cancelPendingLendingDialogOpenRef.current?.();
        cancelPendingLendingDialogOpenRef.current = undefined;
      },
      [],
    );
    const handleActionPress = useCallback(
      async (action: IResolvedDeFiPositionAction) => {
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

        // Sectioned lending positions (Compound/Morpho/...) send Withdraw/Repay
        // to the lending dialog's asset dropdown. A remapped LP withdraw carries
        // buildAction and must keep the generic dialog, hence the guard.
        if (
          preferLendingDialog &&
          (action.action === EDeFiPositionAction.Withdraw ||
            action.action === EDeFiPositionAction.Repay) &&
          !action.buildAction
        ) {
          if (actionPresentation === 'modal-route') {
            navigation.pushModal(EModalRoutes.MainModal, {
              screen: EModalAssetDetailRoutes.DeFiProtocolAction,
              params: {
                mode: 'lending',
                accountId,
                networkId: protocol.networkId,
                actionType:
                  action.action === EDeFiPositionAction.Repay
                    ? 'repay'
                    : 'withdraw',
                source: { type: 'defi', action },
                hasDebts: positionHasDebts,
                onSuccess,
              },
            });
          } else {
            cancelPendingLendingDialogOpenRef.current =
              showProtocolLendingActionDialog({
                accountId,
                networkId: protocol.networkId,
                actionType:
                  action.action === EDeFiPositionAction.Repay
                    ? 'repay'
                    : 'withdraw',
                source: { type: 'defi', action },
                hasDebts: positionHasDebts,
                intl,
                onSuccess,
                dialog: inPageDialog,
              });
          }
          return;
        }

        if (actionPresentation === 'modal-route') {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.DeFiProtocolAction,
            params: {
              mode: 'position',
              accountId,
              networkId: protocol.networkId,
              action,
              // A remapped LP withdraw (buildAction set) does not claim on-chain,
              // so it must never advertise "& Claim rewards".
              hasRewards: hasRewards && !action.buildAction,
              hasDebts: positionHasDebts,
              rewardAssets: defiActionUtils.getPositionRewardAssets(position),
              onSuccess,
            },
          });
          return;
        }

        showProtocolPositionActionDialog({
          accountId,
          networkId: protocol.networkId,
          action,
          // A remapped LP withdraw (buildAction set) does not claim on-chain,
          // so it must never advertise "& Claim rewards".
          hasRewards: hasRewards && !action.buildAction,
          hasDebts: positionHasDebts,
          rewardAssets: defiActionUtils.getPositionRewardAssets(position),
          onSuccess,
          dialog: inPageDialog,
        });
      },
      [
        accountId,
        actionPresentation,
        hasRewards,
        inPageDialog,
        intl,
        navigation,
        onSuccess,
        position,
        positionHasDebts,
        preferLendingDialog,
        protocol.networkId,
        submitProtocolPositionAction,
      ],
    );
    const handleManagePress = useCallback(
      (type: EManagePositionType) => {
        if (!accountId) return;
        const actionType: IProtocolLendingActionType =
          type === EManagePositionType.Repay ? 'repay' : 'withdraw';
        const params =
          type === EManagePositionType.Repay
            ? repayManageParams
            : withdrawManageParams;
        if (!params) return;
        const source = {
          type: 'borrow' as const,
          provider: params.provider,
          marketAddress: params.marketAddress,
          reserveAddress: params.reserveAddress,
          symbol: params.symbol,
          debtAmount: params.debtAmount,
          logoURI: params.logoURI,
          providerDisplayName: params.providerDisplayName,
          providerLogoURI: params.providerLogoURI,
          indexedAccountId: protocol.indexedAccountId ?? indexedAccountId,
          // A row-scoped button already names the asset (fixed); the
          // position-level block button lets the dialog's dropdown choose it.
          selectable: !manageAsset,
        };
        if (actionPresentation === 'modal-route') {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.DeFiProtocolAction,
            params: {
              mode: 'lending',
              accountId,
              networkId: protocol.networkId,
              actionType,
              source,
              hasDebts: positionHasDebts,
              onSuccess,
            },
          });
        } else {
          cancelPendingLendingDialogOpenRef.current =
            showProtocolLendingActionDialog({
              accountId,
              networkId: protocol.networkId,
              actionType,
              source,
              hasDebts: positionHasDebts,
              intl,
              onSuccess,
              dialog: inPageDialog,
            });
        }
      },
      [
        accountId,
        actionPresentation,
        indexedAccountId,
        inPageDialog,
        intl,
        manageAsset,
        navigation,
        onSuccess,
        positionHasDebts,
        protocol.indexedAccountId,
        protocol.networkId,
        repayManageParams,
        withdrawManageParams,
      ],
    );

    if (
      !shouldResolveActionButtons ||
      (renderedActions.length === 0 && !shouldShowManage)
    ) {
      return null;
    }

    const isInfo = visualVariant === 'info';
    const isBlock = block;
    const actionButtonFrameProps = getActionButtonFrameProps({
      isInfo,
      isBlock,
    });
    const buttonSize = isBlock ? 'medium' : 'small';
    // A shared floor width turns ragged content-width chips into an aligned
    // column; skipped in block mode, where buttons already flex to fill.
    const fixedActionWidthProps =
      actionMinWidth && !isBlock ? { minWidth: actionMinWidth } : undefined;
    let containerGap = '$1.5';
    if (isBlock) {
      containerGap = '$2.5';
    } else if (isInfo) {
      containerGap = '$1';
    }

    return (
      <XStack
        gap={containerGap}
        alignItems={isBlock ? 'stretch' : 'center'}
        justifyContent={isInfo || isBlock ? 'flex-start' : 'flex-end'}
        width={isBlock ? '100%' : undefined}
        flexShrink={isBlock ? undefined : 1}
        flexWrap={isBlock ? 'nowrap' : 'wrap'}
        minWidth={isBlock ? undefined : 0}
        {...containerProps}
      >
        {shouldShowManage
          ? manageActionTypes.map((manageType) => (
              <Button
                key={manageType}
                testID={`defi-position-action-manage-${manageType}`}
                size={buttonSize}
                {...actionButtonFrameProps}
                {...fixedActionWidthProps}
                disabled={Boolean(submittingActionKey)}
                onPress={() => handleManagePress(manageType)}
              >
                {renderActionButtonLabel({
                  isInfo,
                  isBlock,
                  label: getManageActionLabel({ type: manageType, intl }),
                })}
              </Button>
            ))
          : null}
        {renderedActions.map((action) => {
          const actionKey = getResolvedActionKey(action);
          return (
            <Button
              key={actionKey}
              testID={`defi-position-action-${action.action}`}
              size={buttonSize}
              {...actionButtonFrameProps}
              {...fixedActionWidthProps}
              disabled={Boolean(submittingActionKey)}
              loading={submittingActionKey === actionKey}
              onPress={() => void handleActionPress(action)}
            >
              {renderActionButtonLabel({
                isInfo,
                isBlock,
                label: getActionLabel({
                  action: action.action,
                  intl,
                  hasRewards: hasRewards && !action.buildAction,
                }),
              })}
            </Button>
          );
        })}
      </XStack>
    );
  },
);

ProtocolPositionActionButton.displayName = 'ProtocolPositionActionButton';

export { ProtocolPositionActionButton };
