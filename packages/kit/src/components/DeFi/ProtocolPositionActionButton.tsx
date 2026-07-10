import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  XStack,
  useInPageDialog,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import {
  EDeFiPositionAction,
  type IDeFiAsset,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
  type IResolvedDeFiPositionAction,
} from '@onekeyhq/shared/types/defi';

import { showProtocolLendingActionDialog } from './ProtocolLendingActionDialog';
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
  // The specific asset this button acts on. When set, the resolved action is
  // scoped to this asset so each supplied/borrowed row targets its own token.
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
    protocol,
    position,
    supportedActions,
    placement = 'all',
    manageAsset,
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
    // A per-asset caller (manageAsset set) shows each row's own scoped action;
    // an unscoped caller keeps the position-level actions on the first row only.
    let renderedActions: IResolvedDeFiPositionAction[] = [];
    if (manageAsset) {
      renderedActions = scopedVisibleActions;
    } else if (showResolvedActions) {
      renderedActions = visibleActions;
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

        // Sectioned lending positions send Withdraw/Repay to the lending
        // dialog's asset dropdown. A remapped LP withdraw carries buildAction
        // and must keep the generic dialog, hence the guard.
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
    if (!shouldResolveActionButtons || renderedActions.length === 0) {
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
