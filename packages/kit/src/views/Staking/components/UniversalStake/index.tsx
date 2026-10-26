import type { PropsWithChildren, ReactElement, ReactNode, Ref } from 'react';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type {
  IDialogInstance,
  IElement,
  IXStackProps,
} from '@onekeyhq/components';
import {
  Alert,
  Dialog,
  HeightTransition,
  Icon,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_HEIGHT,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { isAccountIdDeactivatedBotWallet } from '@onekeyhq/kit/src/utils/botWalletAccountUtils';
import { showBotWalletDeactivatedWarningDialog } from '@onekeyhq/kit/src/utils/botWalletWarningDialog';
import {
  fillLeadingZero,
  getStartAmount,
  validateAmountInputForStaking,
} from '@onekeyhq/kit/src/utils/validateAmountInput';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { EarnAprSuffixText } from '@onekeyhq/kit/src/views/Earn/components/EarnAprSuffixText';
import { ProtocolListContent } from '@onekeyhq/kit/src/views/Earn/components/showProtocolListDialog';
import {
  buildEmptyAmountFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import type {
  IApproveConfirmFnParams,
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnPermit2ApproveSignData,
  IEarnSelectField,
  IEarnStakeType,
  IEarnText,
  IEarnTokenInfo,
  IEarnTooltip,
  IProtocolInfo,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import {
  EApproveType,
  ECheckAmountActionType,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnPermitApprove } from '../../hooks/useEarnPermitApprove';
import { useEarnSignMessageWithoutVerify } from '../../hooks/useEarnSignMessageWithoutVerify';
import { usePendleLayoutState } from '../../hooks/usePendleLayoutState';
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { countDecimalPlaces, isInvalidAmount } from '../../utils/utils';
import { BtcFeeRateInput } from '../BtcFeeRateInput';
import { EarnFooterFade } from '../EarnFooterFade';
import { showEarnRiskWarningDialog } from '../EarnRiskWarningDialog';
import { useShowStakeEstimateGasAlert } from '../EstimateNetworkFee';
import { EarnPlatformBonusSection } from '../ProtocolDetails/EarnPlatformBonusSection';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EarnValidatorSelect } from '../ProtocolDetails/EarnValidatorSelect';
import { usePendleTransactionDetails } from '../ProtocolDetails/PendleSharedComponents';
import { ProtocolImage, formatTvl } from '../ProtocolDisplayShared';
import {
  calcPriceImpactInfo,
  showHighPriceImpactDialog,
} from '../showHighPriceImpactDialog';
import { EStakeProgressStep, StakeProgress } from '../StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../StakingAmountInput';
import { StakingAmountResultLine } from '../StakingAmountResultLine';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { formatStakingDistanceToNowStrict } from '../utils';

import {
  EarnFormRow,
  EarnFormSummary,
  EarnFormSwitchingContext,
  SHOWN_ROWS_WHEN_FOLDED,
  buildOutcomeValueFromText,
  buildRewardNoteRows,
  buildRewardsOutcome,
  buildRowKeys,
  splitPendleRewardRows,
  useEarnFeeFigure,
} from './EarnFormSummary';
import { hasStakingRewardsSummary } from './StakingConfirmationSummary';

import type { IEarnOutcome } from './EarnFormSummary';
import type {
  IManagePositionFooterAction,
  IManagePositionProtocolSwitchConfig,
} from '../../pages/ManagePosition/components/ManagePositionContent';
import type { IManagePageV2ReceiveInputConfig } from '../ManagePageV2ReceiveInput';

type IShownQuote = {
  // The amount the figures are for; empty for dashes
  amount: string;
  confirmation?: IStakeTransactionConfirmation;
};
const EMPTY_SHOWN_QUOTE: IShownQuote = { amount: '' };
// An emptied box keeps its figures this long, the quotes' own debounce
const QUOTE_SETTLE_MS = 350;
// 25%, 50% and 75% of a balance fill at most this many decimals
const PERCENT_INPUT_DECIMALS = 6;

function withRewardUnit(text: string, rewardUnit: string): string {
  return /\s*(APY|APR)\s*$/i.test(text) ? text : `${text} ${rewardUnit}`;
}

export function getProtocolAprDisplay({
  protocol,
  fallbackText,
}: {
  protocol?: IManagePositionProtocolSwitchConfig['currentProtocol'];
  fallbackText?: string;
}) {
  const rewardUnit = protocol?.provider.rewardUnit || 'APR';

  if (protocol?.aprInfo?.highlight?.text) {
    return {
      text: withRewardUnit(protocol.aprInfo.highlight.text, rewardUnit),
      color: (protocol.aprInfo.highlight.color || '$textSuccess') as string,
      textDecorationLine: 'none' as const,
    };
  }

  if (protocol?.aprInfo?.normal?.text) {
    return {
      text: withRewardUnit(protocol.aprInfo.normal.text, rewardUnit),
      color: (protocol.aprInfo.normal.color || '$text') as string,
      textDecorationLine: 'none' as const,
    };
  }

  if (protocol?.aprInfo?.deprecated?.text) {
    return {
      text: withRewardUnit(protocol.aprInfo.deprecated.text, rewardUnit),
      color: (protocol.aprInfo.deprecated.color || '$textSubdued') as string,
      textDecorationLine: 'line-through' as const,
    };
  }

  if (protocol) {
    return {
      text: `${protocol.provider.aprWithoutFee || '0'} ${rewardUnit}`,
      color: '$textSuccess',
      textDecorationLine: 'none' as const,
    };
  }

  if (fallbackText) {
    return {
      text: fallbackText,
      color: '$textSuccess',
      textDecorationLine: 'none' as const,
    };
  }

  return undefined;
}

function ProtocolSwitchTriggerRow({
  currentProtocol,
  fallbackProviderName,
  fallbackProviderLogoUri,
  fallbackAprText,
  isLoading,
  isSwitchEnabled,
  canSwitchProtocols,
  onPress,
}: {
  currentProtocol?: IManagePositionProtocolSwitchConfig['currentProtocol'];
  fallbackProviderName?: string;
  fallbackProviderLogoUri?: string;
  fallbackAprText?: string;
  isLoading?: boolean;
  /** Interactive right now — false while a tx is in flight (OK-58029) */
  isSwitchEnabled: boolean;
  /** Switchable in principle. Drives layout only, so a transient lock cannot
      change the rendered shape and remount the icon (OK-59957) */
  canSwitchProtocols: boolean;
  onPress: () => void;
}) {
  const providerName = getEarnProviderDisplayName(
    currentProtocol?.provider.name || fallbackProviderName || '',
  );
  const tvlText = formatTvl(currentProtocol?.provider.tvl);
  // Same layout as the quick-switcher dialog item (OK-58854): bottom-left
  // keeps only vaultName, TVL moves under APY/APR on the right
  const subtitle = currentProtocol?.provider.vaultName || '';
  const aprDisplay = getProtocolAprDisplay({
    protocol: currentProtocol,
    fallbackText: fallbackAprText,
  });
  // Presence follows canSwitchProtocols so locking the switcher mid-tx dims the
  // chevron instead of removing it (its removal reflowed the row) (OK-59957)
  const showChevron = canSwitchProtocols || isLoading;
  let aprElement = null;

  if (aprDisplay) {
    // Strikethrough case (deprecated) keeps the original rendering; the
    // regular case renders value + small APY/APR suffix
    aprElement =
      aprDisplay.textDecorationLine === 'line-through' ? (
        <SizableText
          size="$headingLg"
          color={aprDisplay.color}
          textDecorationLine={aprDisplay.textDecorationLine}
        >
          {aprDisplay.text}
        </SizableText>
      ) : (
        <EarnAprSuffixText
          text={aprDisplay.text}
          size="$headingLg"
          color={aprDisplay.color}
        />
      );
  } else if (isLoading) {
    aprElement = <Skeleton h="$5" w={72} borderRadius="$2" />;
  }

  return (
    <ProtocolSwitchRow
      logoURI={currentProtocol?.provider.logoURI || fallbackProviderLogoUri}
      networkLogoURI={currentProtocol?.network.logoURI}
      name={providerName}
      subtitle={subtitle}
      aprElement={aprElement}
      tvlText={tvlText}
      isLoading={isLoading}
      isSwitchEnabled={isSwitchEnabled}
      showChevron={Boolean(showChevron)}
      onPress={onPress}
    />
  );
}

// The switcher row's look, for a selector whose items aren't protocol list
// entries too (the Earn deposit modal's offers)
export function ProtocolSwitchRow({
  logoURI,
  networkLogoURI,
  name,
  subtitle,
  aprElement,
  tvlText,
  isLoading,
  isSwitchEnabled,
  showChevron,
  isExpanded,
  chevronSpace,
  nameAccessory,
  onPress,
  testID,
  keyboardProps,
  ref,
}: {
  logoURI?: string;
  networkLogoURI?: string;
  name: string;
  // Badges after the name
  nameAccessory?: ReactNode;
  subtitle?: string;
  aprElement: ReactNode;
  tvlText?: string;
  isLoading?: boolean;
  isSwitchEnabled: boolean;
  showChevron: boolean;
  // Set when the row opens its list in place under itself rather than in a
  // popover: the chevron turns with the list
  isExpanded?: boolean;
  // The chevron's room left empty, so a row listed under a switch row lines
  // its rate up with the one above
  chevronSpace?: boolean;
  onPress: () => void;
  testID?: string;
  ref?: Ref<IElement>;
  // A tab stop with Enter and Space, where a Popover around it opens on a
  // click only
  keyboardProps?: Pick<
    IXStackProps,
    'tabIndex' | 'onKeyDown' | 'focusVisibleStyle'
  >;
}) {
  let nameLine: ReactNode = (
    <SizableText size="$bodyLgMedium" numberOfLines={1} flex={1}>
      {name}
    </SizableText>
  );
  if (isLoading && !name) {
    nameLine = <Skeleton h="$5" w={96} borderRadius="$2" />;
  } else if (nameAccessory) {
    nameLine = (
      <XStack ai="center" gap="$1.5" minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {name}
        </SizableText>
        {nameAccessory}
      </XStack>
    );
  }
  return (
    <XStack
      ref={ref}
      testID={testID}
      role={isSwitchEnabled ? 'button' : undefined}
      aria-expanded={isSwitchEnabled ? isExpanded : undefined}
      userSelect={isSwitchEnabled ? 'none' : undefined}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      // The logo starts where the amount box's text and the rows below do;
      // a rate with nothing after it ends where their values end, and a
      // chevron's glyph has its own inner space, so less room on its side
      pl="$3.5"
      pr={showChevron || chevronSpace ? '$3' : '$3.5'}
      py="$2"
      bg="$bgSubdued"
      // The amount box's corners, as every block in the form has them
      borderRadius="$3"
      borderCurve="continuous"
      hoverStyle={isSwitchEnabled ? { bg: '$bgHover' } : undefined}
      pressStyle={isSwitchEnabled ? { bg: '$bgActive' } : undefined}
      onPress={isSwitchEnabled ? onPress : undefined}
      {...keyboardProps}
    >
      <XStack flex={1} minWidth={0} gap="$3" alignItems="center">
        <ProtocolImage logoURI={logoURI} networkLogoURI={networkLogoURI} />
        <YStack flex={1} minWidth={0} gap="$0.5">
          {nameLine}
          {subtitle ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <XStack alignItems="center" gap="$1" flexShrink={0}>
        <YStack alignItems="flex-end" gap="$0.5">
          {aprElement}
          {tvlText ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`TVL ${tvlText}`}
            </SizableText>
          ) : null}
        </YStack>
        {showChevron && isExpanded !== undefined ? (
          // As the form's Details row turns its chevron
          <YStack
            transition="fast"
            animateOnly={ANIMATE_ONLY_TRANSFORM}
            rotate={isExpanded ? '180deg' : '0deg'}
          >
            <Icon
              name="ChevronDownSmallSolid"
              color={isSwitchEnabled ? '$iconSubdued' : '$iconDisabled'}
              size="$5"
            />
          </YStack>
        ) : null}
        {!showChevron && chevronSpace ? <Stack w="$5" h="$5" /> : null}
        {showChevron && isExpanded === undefined ? (
          <Icon
            name="ChevronGrabberVerSolid"
            color={isSwitchEnabled ? '$iconSubdued' : '$iconDisabled'}
            size="$5"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}

export function ProtocolSwitcher({
  tokenSymbol,
  accountId,
  fallbackProviderName,
  fallbackProviderLogoUri,
  fallbackAprText,
  protocolSwitchConfig,
  disabled,
}: {
  tokenSymbol: string;
  accountId: string;
  fallbackProviderName?: string;
  fallbackProviderLogoUri?: string;
  fallbackAprText?: string;
  protocolSwitchConfig: IManagePositionProtocolSwitchConfig;
  // Lock the switcher while an approve/stake is in flight, so the protocol list
  // can't be opened over the in-flight tx confirm dialog (OK-58029).
  disabled?: boolean;
}) {
  const intl = useIntl();
  const {
    currentProtocol,
    indexedAccountId,
    isLoading,
    onProtocolSelect,
    protocols,
    selectedProtocol,
  } = protocolSwitchConfig;
  // Split structural from interactive (OK-59957). canSwitchProtocols decides
  // whether the Popover wrapper exists; disabled only removes interactivity.
  // Deriving the tree shape from `disabled` made pressing the stake button
  // swap <Popover renderTrigger={trigger}/> for a bare <trigger/>, which
  // unmounted and remounted the row — reloading the remote protocol image
  // (the visible flicker) and reflowing it as the chevron vanished.
  const canSwitchProtocols = protocols.length > 1;
  const isSwitchEnabled = canSwitchProtocols && !disabled;
  const renderProtocolListContent = useCallback(
    ({
      closePopover,
      isOpen,
    }: {
      closePopover: () => void;
      isOpen?: boolean;
    }) => (
      <ProtocolListContent
        variant="switcher"
        isOpen={isOpen}
        symbol={tokenSymbol}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        protocols={protocols}
        isLoading={isLoading}
        selectedProtocol={selectedProtocol}
        onProtocolSelect={async (protocol) => {
          await onProtocolSelect(protocol);
          closePopover();
        }}
      />
    ),
    [
      accountId,
      indexedAccountId,
      isLoading,
      onProtocolSelect,
      protocols,
      selectedProtocol,
      tokenSymbol,
    ],
  );
  // Always-controlled open state (OK-59957). Passing `open` only while locked
  // would flip Popover between controlled and uncontrolled: its internal
  // isOpen would stay true through the lock and the list would pop itself open
  // again when the tx finished.
  const [isProtocolListOpen, setIsProtocolListOpen] = useState(false);
  const handleProtocolListOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsProtocolListOpen(nextOpen && isSwitchEnabled);
    },
    [isSwitchEnabled],
  );
  useEffect(() => {
    if (!isSwitchEnabled) {
      setIsProtocolListOpen(false);
    }
  }, [isSwitchEnabled]);

  const trigger = (
    <ProtocolSwitchTriggerRow
      currentProtocol={currentProtocol}
      fallbackProviderName={fallbackProviderName}
      fallbackProviderLogoUri={fallbackProviderLogoUri}
      fallbackAprText={fallbackAprText}
      isLoading={isLoading}
      isSwitchEnabled={isSwitchEnabled}
      canSwitchProtocols={canSwitchProtocols}
      onPress={() => {}}
    />
  );

  // Only a genuinely single-protocol asset drops the Popover wrapper — that is
  // stable for the lifetime of the screen, so the trigger is never remounted
  // mid-interaction (OK-59957)
  if (!canSwitchProtocols) {
    return trigger;
  }

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.defi_select_protocol })}
      placement="bottom-end"
      // Locked mid-tx (OK-58029) simply stays closed, rather than unmounting
      // the Popover and changing the tree shape (OK-59957)
      open={isProtocolListOpen}
      onOpenChange={handleProtocolListOpenChange}
      renderTrigger={trigger}
      floatingPanelProps={{
        w: 360,
        p: '$0',
      }}
      renderContent={renderProtocolListContent}
    />
  );
}

// A line under the amount box (an error) grows or folds in this long
const AMOUNT_LINE_MS = 200;
// The swap form's line under the box: its top space and one line of text
const DEPOSIT_LINE_HEIGHT = 28;

// The rows a Pendle quote brings first, as the last quote had them (every
// market has the same): Pendle quotes nothing for an empty amount, so the
// next form holds them in place with dashes until its own first quote
let lastPendleRows: { title: string; tooltip?: IEarnTooltip }[] | undefined;

// The room a line under the box took in the form shown before, closing
// over AMOUNT_LINE_MS, so what is below moves up rather than jumping
function ClosingRoom({ height }: { height: number }) {
  const [isClosed, setIsClosed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsClosed(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <YStack
      h={isClosed ? 0 : height}
      transition="quick"
      animateOnly={ANIMATE_ONLY_HEIGHT}
    />
  );
}

type IUniversalStakeProps = {
  accountId: string;
  networkId: string;
  balance: string;

  tokenImageUri?: string;
  /**
   * Token metadata still resolving and no image came in via route params —
   * skeleton the icon instead of flashing the placeholder coin (OK-59961)
   */
  tokenImageLoading?: boolean;
  tokenSymbol?: string;

  decimals?: number;
  // An amount to start on, entered once as if typed (the Earn Router page
  // after a withdrawal: what it took out)
  // Shown in place of the swap form (Pay with back on the token itself):
  // the room its line under the box took closes rather than vanishing
  collapsesDepositLine?: boolean;
  initialAmount?: string;

  providerName?: string;
  providerLogo?: string;

  minTransactionFee?: string;
  apr?: string;

  isDisabled?: boolean;
  // The balance is not known yet: its place shows the box's skeleton
  balanceLoading?: boolean;

  estimateFeeUTXO?: Required<Pick<IFeeUTXO, 'feeRate'>>[];

  currentAllowance?: string;

  approveType?: EApproveType;
  // Resolves false when the flow never started (risk disclaimer rejected, a
  // pre-flight check failed), so the form keeps the amount the user typed.
  // Deliberately not `boolean | void`: a caller that forgets to return the
  // hook's result would silently reset the form.
  onConfirm?: (params: IApproveConfirmFnParams) => Promise<boolean>;
  onFeeRateChange?: (rate: string) => void;

  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  approveTarget: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token?: IToken;
  };
  postWrapApproveTarget?: {
    spenderAddress: string;
    token?: IToken;
  };
  beforeFooter?: ReactElement | null;
  footerActionOverride?: IManagePositionFooterAction;
  // A new key presses the button once by itself, as soon as the amount has
  // passed its checks: the swap that paid for this deposit asked for it
  autoSubmitKey?: number;
  // Told when that press happens, so a remounted form doesn't press again
  onAutoSubmit?: () => void;
  protocolSwitchConfig?: IManagePositionProtocolSwitchConfig;
  showApyDetail?: boolean;
  suppressPlatformBonus?: boolean;
  // Pay with already pays with another token, so the form shows no
  // "Not enough X? Trade Buy" row
  hideTradeOrBuy?: boolean;
  // The caller's own protocol selector (the Earn deposit modal's offers),
  // drawn where the protocol switcher goes
  offerSwitch?: ReactNode;
  // What is typed, so a caller that starts the form over can carry it
  onAmountChange?: (amount: string) => void;
  isInModalContext?: boolean;
  ongoingValidator?: IEarnSelectField;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  transactionInputTokenAddress?: string;
  transactionOutputTokenAddress?: string;
  requestSymbol?: string;
  stakeType?: IEarnStakeType;
  inputTitle?: string;
  tokenSelectorTriggerProps?: Partial<
    NonNullable<IAmountInputFormItemProps['tokenSelectorTriggerProps']>
  >;
  // Inside the amount box under its balance line: Pay with's token list
  amountBoxBottom?: ReactNode;
  amountBoxTestID?: string;
  // A balance read as zero gets Swap's refresh in place of Max (Pay with)
  onRefreshBalance?: () => Promise<unknown> | void;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
  pendleSlippage?: number;
};

export function UniversalStake({
  accountId,
  networkId,
  balance,
  decimals,
  collapsesDepositLine,
  initialAmount,
  minTransactionFee = '0',
  tokenImageUri,
  tokenImageLoading,
  tokenSymbol,
  providerName = '',
  providerLogo,
  estimateFeeUTXO,
  isDisabled,
  balanceLoading,
  onConfirm,
  onFeeRateChange,
  protocolInfo,
  tokenInfo,
  approveType,
  approveTarget,
  postWrapApproveTarget,
  currentAllowance,
  beforeFooter,
  footerActionOverride,
  autoSubmitKey,
  onAutoSubmit,
  protocolSwitchConfig,
  showApyDetail = false,
  suppressPlatformBonus = false,
  hideTradeOrBuy = false,
  offerSwitch,
  onAmountChange,
  isInModalContext = false,
  ongoingValidator,
  receiveInputConfig,
  transactionInputTokenAddress,
  transactionOutputTokenAddress,
  requestSymbol,
  stakeType,
  inputTitle,
  tokenSelectorTriggerProps,
  amountBoxBottom,
  amountBoxTestID,
  onRefreshBalance,
  isQuoteExpired,
  onQuoteReset,
  refreshKey,
  onQuoteRefreshingChange,
  pendleSlippage,
}: PropsWithChildren<IUniversalStakeProps>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  // A start amount (what was typed before a switch to another protocol) is
  // in the box from the first frame, so the form drawn again doesn't flash
  // empty
  const [amountValue, setAmountValue] = useState(() =>
    getStartAmount(initialAmount, decimals),
  );
  // Asked as the form mounts, and kept: the room closes over its own time
  // whatever renders come after
  const [closesDepositLineRoom] = useState(Boolean(collapsesDepositLine));
  const transactionConfirmationAmountRef = useRef(amountValue);
  transactionConfirmationAmountRef.current = amountValue;
  const [approving, setApproving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedValidator, setSelectedValidator] = useState<
    string | undefined
  >(ongoingValidator?.select?.defaultValue);

  // Reset selectedValidator when accountId/networkId changes (manage-page re-fetches)
  useEffect(() => {
    setSelectedValidator(ongoingValidator?.select?.defaultValue);
  }, [ongoingValidator?.select?.defaultValue]);

  const shouldSendProtocolVault = useMemo(
    () => earnUtils.shouldSendEarnProtocolVault({ providerName }),
    [providerName],
  );
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;
  const networkLogoURI =
    protocolSwitchConfig?.currentProtocol?.network.logoURI ?? network?.logoURI;

  const [estimateFeeResp, setEstimateFeeResp] = useState<
    undefined | IEarnEstimateFeeResp
  >();
  // The amount that estimate is for ('' for none)
  const [estimateFeeAmount, setEstimateFeeAmount] = useState('');

  const { getPermitSignature } = useEarnPermitApprove();
  const signPersonalMessage = useEarnSignMessageWithoutVerify();
  const { getPermitCache, updatePermitCache } = useEarnActions().current;

  const isStakefishProvider = useMemo(
    () => earnUtils.isStakefishProvider({ providerName }),
    [providerName],
  );
  const isPendleProvider = useMemo(
    () => earnUtils.isPendleProvider({ providerName }),
    [providerName],
  );
  const actionSymbol = useMemo(
    () => requestSymbol || tokenInfo?.token.symbol || tokenSymbol || '',
    [requestSymbol, tokenInfo?.token.symbol, tokenSymbol],
  );
  const isStakefishEthStake = useMemo(
    () => isStakefishProvider && actionSymbol.toUpperCase() === 'ETH',
    [actionSymbol, isStakefishProvider],
  );
  const isStakefishCreateNewValidator = useMemo(() => {
    if (!isStakefishEthStake || !selectedValidator) {
      return false;
    }
    const selectedOption = ongoingValidator?.select?.options?.find(
      (option) => option.value === selectedValidator,
    );
    return selectedOption?.extra?.isCreateNewValidator === true;
  }, [
    isStakefishEthStake,
    selectedValidator,
    ongoingValidator?.select?.options,
  ]);
  const stakefishPermitSignatureRef = useRef<string | undefined>(undefined);
  const stakefishPermitMessageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    stakefishPermitSignatureRef.current = undefined;
    stakefishPermitMessageRef.current = undefined;
  }, [
    accountId,
    amountValue,
    actionSymbol,
    networkId,
    providerName,
    selectedValidator,
  ]);

  const useApprove = useMemo(() => !!approveType, [approveType]);
  const usePermit2Approve = approveType === EApproveType.Permit;
  const permitSignatureRef = useRef<string | undefined>(undefined);
  const permit2DataRef = useRef<IEarnPermit2ApproveSignData | undefined>(
    undefined,
  );
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const isFocus = useIsFocused();

  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
    tokenAddress: approveTarget.token?.address || '',
    spenderAddress: approveTarget.spenderAddress,
    initialValue: currentAllowance ?? '0',
    approveType,
  });
  const shouldApproveWhenFocused = useMemo(() => {
    if (!useApprove) {
      return false;
    }

    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);

    if (usePermit2Approve) {
      // Check permit cache first
      const permitCache = getPermitCache({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
        tokenAddress: approveTarget.token?.address || '',
        amount: amountValue,
      });
      if (permitCache) {
        permitSignatureRef.current = permitCache.signature;
        permit2DataRef.current = permitCache.permit2Data;
        return false;
      }
    }

    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [
    useApprove,
    amountValue,
    allowance,
    usePermit2Approve,
    getPermitCache,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.token?.address,
  ]);
  const lastFocusedShouldApproveRef = useRef(shouldApproveWhenFocused);
  if (isFocus) {
    lastFocusedShouldApproveRef.current = shouldApproveWhenFocused;
  }
  const shouldApprove = isFocus
    ? shouldApproveWhenFocused
    : useApprove && lastFocusedShouldApproveRef.current;

  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >();
  // Stakefish: identity for existing validator
  const stakefishIdentity =
    isStakefishProvider && !isStakefishCreateNewValidator
      ? selectedValidator
      : undefined;

  const fetchTransactionConfirmation = useCallback(
    async (amount: string) => {
      if (isDisabled) {
        return undefined;
      }
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol: actionSymbol,
          vault: shouldSendProtocolVault ? protocolInfo?.vault || '' : '',
          accountAddress: protocolInfo?.earnAccount?.accountAddress || '',
          action: ECheckAmountActionType.STAKING,
          amount,
          identity: stakefishIdentity,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
        });
      return resp;
    },
    [
      isDisabled,
      networkId,
      providerName,
      actionSymbol,
      shouldSendProtocolVault,
      protocolInfo?.vault,
      protocolInfo?.earnAccount?.accountAddress,
      stakefishIdentity,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      pendleSlippage,
    ],
  );

  const [transactionConfirmationLoading, setTransactionConfirmationLoading] =
    useState(false);
  // What the rows show: the latest quote for an amount, kept (dimmed) while
  // the next amount's is fetched, so the rows swap figures in place
  const [shownQuote, setShownQuote] = useState<IShownQuote>(EMPTY_SHOWN_QUOTE);
  // Pendle's refresh brings a new quote for the amount in the box
  const setRefreshedConfirmation = useCallback(
    (resp?: IStakeTransactionConfirmation) => {
      setTransactionConfirmation(resp);
      setShownQuote({
        amount: transactionConfirmationAmountRef.current,
        confirmation: resp,
      });
    },
    [],
  );
  // What the amount buys (Pendle), kept with the amount it was quoted for
  const [receiveQuote, setReceiveQuote] = useState<
    { amount?: string; description?: IEarnText } | undefined
  >(undefined);
  // The amount whose figure the line last showed
  const lineShownAmountRef = useRef<string | undefined>(undefined);

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      setTransactionConfirmationLoading(true);
      let receiveDescription: IEarnText | undefined;
      try {
        const resp = await fetchTransactionConfirmation(amount || '0');
        if (transactionConfirmationAmountRef.current !== amount) {
          return;
        }
        setTransactionConfirmation(resp);
        setShownQuote({ amount: amount || '', confirmation: resp });
        receiveDescription = resp?.receive?.description;
        if (resp && amount && Number(amount) > 0) {
          onQuoteReset?.();
        }
      } catch {
        // keep stale state; the rows show dashes rather than another
        // amount's figures
        if (transactionConfirmationAmountRef.current === amount) {
          setShownQuote({ amount: amount || '' });
        }
      } finally {
        if (transactionConfirmationAmountRef.current === amount) {
          setTransactionConfirmationLoading(false);
          setReceiveQuote({ amount, description: receiveDescription });
        }
      }
    },
    350,
  );

  // What the rows show while there is no amount: the last quote's rows,
  // else what the server gives for an empty amount. So the rows keep their
  // places with a dash rather than coming and going with the amount. Only
  // their labels show, so the last answer for this offer opens the form
  // complete while this one is fetched
  const emptyAmountKey = buildEmptyAmountFirstFrameKey({
    networkId,
    providerName,
    symbol: actionSymbol,
    vault: shouldSendProtocolVault ? protocolInfo?.vault : undefined,
  });
  const [emptyAmountConfirmation, setEmptyAmountConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >(() => readFirstFrame(emptyAmountKey));
  useEffect(() => {
    let cancelled = false;
    fetchTransactionConfirmation('0')
      .then((resp) => {
        if (!cancelled) {
          setEmptyAmountConfirmation(resp);
          keepFirstFrame(emptyAmountKey, resp);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [emptyAmountKey, fetchTransactionConfirmation]);
  const lastConfirmationRef = useRef<IStakeTransactionConfirmation | undefined>(
    undefined,
  );
  if (transactionConfirmation) {
    lastConfirmationRef.current = transactionConfirmation;
  }

  const protocolVault = shouldSendProtocolVault
    ? protocolInfo?.vault || ''
    : undefined;

  const fetchEstimateFeeResp = useCallback(
    async (amount?: string) => {
      if (shouldApprove && usePermit2Approve) {
        return undefined;
      }
      if (!amount) {
        return undefined;
      }
      const amountNumber = BigNumber(amount);
      if (amountNumber.isZero() || amountNumber.isNaN()) {
        return undefined;
      }

      const permitParams: {
        approveType?: 'permit';
        permitSignature?: string;
      } = {};

      if (usePermit2Approve && !shouldApprove) {
        permitParams.approveType = EApproveType.Permit;
        if (permitSignatureRef.current) {
          const amountBN = BigNumber(amount);
          const allowanceBN = BigNumber(allowance);
          if (amountBN.gt(allowanceBN)) {
            permitParams.permitSignature = permitSignatureRef.current;
          }
        }
      }

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const resp = await backgroundApiProxy.serviceStaking.estimateFee({
        networkId,
        provider: providerName,
        symbol: actionSymbol,
        action: shouldApprove ? 'approve' : 'stake',
        amount: amountNumber.toFixed(),
        protocolVault,
        accountAddress: account?.address,
        inputTokenAddress: transactionInputTokenAddress,
        outputTokenAddress: transactionOutputTokenAddress,
        stakeType,
        ...permitParams,
      });
      return resp;
    },
    [
      accountId,
      allowance,
      networkId,
      protocolVault,
      providerName,
      shouldApprove,
      actionSymbol,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      stakeType,
      usePermit2Approve,
    ],
  );

  const debouncedFetchEstimateFeeResp = useDebouncedCallback(
    async (amount?: string) => {
      const resp = await fetchEstimateFeeResp(amount);
      setEstimateFeeResp(resp);
      setEstimateFeeAmount(amount ?? '');
    },
    350,
  );

  const checkEstimateGasAlert = useCallback(
    async (onNext: () => Promise<void> | undefined) => {
      if (usePermit2Approve) {
        return onNext();
      }

      setApproving(true);

      const response = await fetchEstimateFeeResp(amountValue);

      setApproving(false);
      if (!response) {
        return onNext();
      }
      const daySpent = Number(response?.coverFeeSeconds || 0) / 3600 / 24;

      if (!daySpent || daySpent <= 5) {
        return onNext();
      }

      showEstimateGasAlert({
        daysConsumed: formatStakingDistanceToNowStrict(
          response.coverFeeSeconds,
        ),
        estFiatValue: response.feeFiatValue,
        onConfirm: async (dialogInstance: IDialogInstance) => {
          await dialogInstance.close();
          await onNext();
        },
      });
    },
    [
      usePermit2Approve,
      fetchEstimateFeeResp,
      amountValue,
      showEstimateGasAlert,
    ],
  );

  const prevShouldApproveRef = useRef<boolean | undefined>(undefined);
  const isWrapStake = stakeType === 'wrap';
  const wrapStakeLabel = useMemo(
    () =>
      intl.formatMessage(
        { id: ETranslations.Limit_native_token_no_sell_wrap },
        { token: actionSymbol || tokenInfo?.token.symbol || tokenSymbol || '' },
      ),
    [actionSymbol, intl, tokenInfo?.token.symbol, tokenSymbol],
  );

  const fetchPostWrapAllowance = useCallback(async () => {
    if (
      !isWrapStake ||
      !postWrapApproveTarget?.token?.address ||
      !postWrapApproveTarget.spenderAddress
    ) {
      return undefined;
    }

    const allowanceInfo =
      await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        accountId,
        networkId,
        spenderAddress: postWrapApproveTarget.spenderAddress,
        tokenAddress: postWrapApproveTarget.token.address,
      });

    return allowanceInfo.allowanceParsed;
  }, [
    accountId,
    isWrapStake,
    networkId,
    postWrapApproveTarget?.spenderAddress,
    postWrapApproveTarget?.token?.address,
  ]);

  const getShouldShowPostWrapApproveStep = useCallback(
    (allowanceValue?: string) => {
      if (!isWrapStake) {
        return false;
      }

      const amountBN = new BigNumber(amountValue);
      if (amountBN.isNaN() || amountBN.lte(0)) {
        return false;
      }

      if (
        !postWrapApproveTarget?.token?.address ||
        !postWrapApproveTarget.spenderAddress
      ) {
        return true;
      }

      const allowanceBN = new BigNumber(allowanceValue ?? '0');
      return allowanceBN.isNaN() || allowanceBN.lt(amountBN);
    },
    [
      amountValue,
      isWrapStake,
      postWrapApproveTarget?.spenderAddress,
      postWrapApproveTarget?.token?.address,
    ],
  );

  const { result: postWrapAllowance } = usePromiseResult(
    fetchPostWrapAllowance,
    [fetchPostWrapAllowance],
    {
      undefinedResultIfReRun: true,
    },
  );

  const estimatedShouldShowPostWrapApproveStep = useMemo(
    () => getShouldShowPostWrapApproveStep(postWrapAllowance),
    [getShouldShowPostWrapApproveStep, postWrapAllowance],
  );
  const [
    shouldShowPostWrapApproveStepOverride,
    setShouldShowPostWrapApproveStepOverride,
  ] = useState<boolean | undefined>(undefined);
  const shouldShowPostWrapApproveStep =
    shouldShowPostWrapApproveStepOverride ??
    estimatedShouldShowPostWrapApproveStep;

  const stakeProgressStep2LabelId = useMemo(() => {
    if (shouldShowPostWrapApproveStep) {
      return ETranslations.global_approve;
    }
    return isPendleProvider ? ETranslations.global_buy : undefined;
  }, [isPendleProvider, shouldShowPostWrapApproveStep]);

  const stakeProgressStep3LabelId = shouldShowPostWrapApproveStep
    ? ETranslations.earn_deposit
    : undefined;

  useEffect(() => {
    const amountValueBN = new BigNumber(amountValue);
    // Check if shouldApprove transitioned from true to false and amount is valid
    if (
      prevShouldApproveRef.current === true &&
      !shouldApprove &&
      !amountValueBN.isNaN() &&
      amountValueBN.gt(0)
    ) {
      void debouncedFetchEstimateFeeResp(amountValue);
    }
    prevShouldApproveRef.current = shouldApprove;
    if (!isInvalidAmount(amountValue) && amountValueBN.isGreaterThan(0)) {
      void debouncedFetchTransactionConfirmation(amountValue);
    } else {
      debouncedFetchTransactionConfirmation.cancel();
      setTransactionConfirmation(undefined);
      setTransactionConfirmationLoading(false);
    }
    return () => {
      debouncedFetchTransactionConfirmation.cancel();
    };
  }, [
    shouldApprove,
    amountValue,
    debouncedFetchEstimateFeeResp,
    debouncedFetchTransactionConfirmation,
    stakefishIdentity,
  ]);

  const { quoteRefreshing, handleLocalRefreshQuote } = useQuoteRefresh({
    enabled: isPendleProvider,
    refreshKey,
    amountValue,
    fetchTransactionConfirmation,
    setTransactionConfirmation: setRefreshedConfirmation,
    onQuoteReset,
    onQuoteRefreshingChange,
  });

  useEffect(
    () => () => {
      allowanceAbortRef.current?.abort();
    },
    [],
  );

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });

  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  // The amount the last check answered for
  const [checkedAmount, setCheckedAmount] = useState<string>();
  const checkAmountRequestIdRef = useRef(0);

  const quoteLoading = checkAmountLoading || transactionConfirmationLoading;

  const checkAmount = useDebouncedCallback(
    async ({
      amount,
      identity,
      requestId,
    }: {
      amount: string;
      identity?: string;
      requestId: number;
    }) => {
      if (
        requestId !== checkAmountRequestIdRef.current ||
        isInvalidAmount(amount)
      ) {
        return;
      }
      // An empty form is represented as "0" by the initial effect. Treat it as
      // not entered yet so the disabled CTA does not flash a loading spinner.
      if (new BigNumber(amount).isLessThanOrEqualTo(0)) {
        return;
      }
      setCheckAmountLoading(true);
      try {
        const response = await backgroundApiProxy.serviceStaking.checkAmount({
          accountId,
          networkId,
          symbol: actionSymbol,
          provider: providerName,
          action: identity
            ? ECheckAmountActionType.RESTAKE
            : ECheckAmountActionType.STAKING,
          amount,
          protocolVault,
          withdrawAll: false,
          identity,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
          stakeType,
        });
        if (requestId !== checkAmountRequestIdRef.current) {
          return;
        }

        if (Number(response.code) === 0) {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts(response.data?.alerts || []);
        } else {
          setCheckoutAmountMessage(response.message);
          setCheckAmountAlerts([]);
        }
        setCheckedAmount(amount);
      } finally {
        if (requestId === checkAmountRequestIdRef.current) {
          setCheckAmountLoading(false);
        }
      }
    },
    300,
  );

  useEffect(() => {
    checkAmount.cancel();
    checkAmountRequestIdRef.current += 1;
    const requestId = checkAmountRequestIdRef.current;
    const amount = amountValue || '0';
    const cleanup = () => {
      checkAmount.cancel();
      if (requestId === checkAmountRequestIdRef.current) {
        checkAmountRequestIdRef.current += 1;
      }
    };

    if (isInvalidAmount(amount)) {
      setCheckAmountLoading(false);
      return cleanup;
    }

    if (new BigNumber(amount).isLessThanOrEqualTo(0)) {
      setCheckoutAmountMessage('');
      setCheckAmountAlerts([]);
      setCheckAmountLoading(false);
      return cleanup;
    }

    void checkAmount({ amount, identity: stakefishIdentity, requestId });
    return cleanup;
  }, [checkAmount, stakefishIdentity, amountValue]);

  const onChangeAmountValue = useCallback(
    (text: string) => {
      const value = fillLeadingZero(text);
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
          setCheckoutAmountMessage('');
          setCheckAmountAlerts([]);
          void debouncedFetchEstimateFeeResp();
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
        Number(decimals) > 0 &&
        countDecimalPlaces(value) > decimals,
      );
      if (!isOverflowDecimals) {
        setAmountValue(value);
        void debouncedFetchEstimateFeeResp(value);
      }
    },
    [decimals, debouncedFetchEstimateFeeResp],
  );

  // Entered once, as soon as both it and the decimals are in: the loading
  // form StakeSection shows first is this same instance, without either
  const isInitialAmountAppliedRef = useRef(false);
  // What is typed goes out as it changes, and only then: a new start amount
  // or callback (Pay with clearing it for another token) mustn't send the old
  // amount out again. While the start amount is still to come the box is
  // only empty for now
  const onAmountChangeRef = useRef(onAmountChange);
  onAmountChangeRef.current = onAmountChange;
  const initialAmountRef = useRef(initialAmount);
  initialAmountRef.current = initialAmount;
  useEffect(() => {
    if (initialAmountRef.current && !isInitialAmountAppliedRef.current) {
      return;
    }
    onAmountChangeRef.current?.(amountValue);
  }, [amountValue]);
  useEffect(() => {
    if (
      isInitialAmountAppliedRef.current ||
      !initialAmount ||
      decimals === undefined
    ) {
      return;
    }
    isInitialAmountAppliedRef.current = true;
    onChangeAmountValue(initialAmount);
  }, [decimals, initialAmount, onChangeAmountValue]);

  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);
  const [stakeProgressStep, setStakeProgressStep] = useState(
    EStakeProgressStep.approve,
  );
  const handleStakeProgressChange = useCallback(
    (step: number, options?: { shouldShowPostWrapApproveStep?: boolean }) => {
      if (options?.shouldShowPostWrapApproveStep !== undefined) {
        setShouldShowPostWrapApproveStepOverride(
          options.shouldShowPostWrapApproveStep,
        );
      }
      setStakeProgressStep(step);
    },
    [],
  );

  useEffect(() => {
    setShouldShowPostWrapApproveStepOverride(undefined);
    setStakeProgressStep(EStakeProgressStep.approve);
  }, [
    accountId,
    amountValue,
    networkId,
    postWrapApproveTarget?.spenderAddress,
    postWrapApproveTarget?.token?.address,
    stakeType,
  ]);

  const maxAmountValue = useMemo(() => {
    const balanceBN = new BigNumber(balance);
    if (balanceBN.isNaN()) {
      return balance;
    }

    const maxAmountBN = tokenInfo?.token?.isNative
      ? BigNumber.max(0, balanceBN.minus(minTransactionFee))
      : balanceBN;

    return typeof decimals === 'number'
      ? maxAmountBN.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
      : maxAmountBN.toFixed();
  }, [balance, decimals, minTransactionFee, tokenInfo?.token?.isNative]);

  const reserveGasFormatter: INumberFormatProps = useMemo(
    () => ({
      formatter: 'balance',
      formatterOptions: {
        tokenSymbol: tokenSymbol || tokenInfo?.token.symbol,
      },
    }),
    [tokenInfo?.token.symbol, tokenSymbol],
  );

  const showNativeTokenMaxToast = useCallback(() => {
    if (!tokenInfo?.token?.isNative) {
      return;
    }

    const reserveFeeBN = new BigNumber(minTransactionFee || 0);
    const reserveFeeFormatted =
      reserveFeeBN.gt(0) && !reserveFeeBN.isNaN()
        ? numberFormat(reserveFeeBN.toFixed(), reserveGasFormatter)
        : undefined;

    const message = intl.formatMessage(
      {
        id: reserveFeeFormatted
          ? ETranslations.swap_native_token_max_tip_already
          : ETranslations.swap_native_token_max_tip,
      },
      {
        num_token: reserveFeeFormatted,
      },
    );

    Toast.message({
      title: message,
    });
  }, [
    intl,
    minTransactionFee,
    reserveGasFormatter,
    tokenInfo?.token?.isNative,
  ]);

  const onMax = useCallback(() => {
    showNativeTokenMaxToast();
    onChangeAmountValue(maxAmountValue);
  }, [maxAmountValue, onChangeAmountValue, showNativeTokenMaxToast]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      if (percent === 100) {
        onMax();
        return;
      }
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          // A share of the balance reads as an amount, not 18 decimals
          decimals: Math.min(
            decimals ?? PERCENT_INPUT_DECIMALS,
            PERCENT_INPUT_DECIMALS,
          ),
        }),
      );
    },
    [balance, decimals, onChangeAmountValue, onMax],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(tokenInfo?.price) > 0) {
      const amountValueBn = new BigNumber(amountValue);
      return amountValueBn.multipliedBy(tokenInfo?.price ?? '0').toFixed();
    }
    return undefined;
  }, [amountValue, tokenInfo?.price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gt(balance),
    [amountValue, balance],
  );

  const isStakingCapFull = useMemo(() => {
    if (!protocolInfo?.remainingCap) {
      return false;
    }
    const remainingCapBN = new BigNumber(protocolInfo.remainingCap);
    return !remainingCapBN.isNaN() && remainingCapBN.isEqualTo(0);
  }, [protocolInfo?.remainingCap]);

  // The server's word on an amount over the balance stops once the amount is
  // back within it, not when its next check comes in (Pendle's speaks of a
  // deposit balance, a second message for what the user just put right)
  const isStaleOverBalanceMessage =
    checkedAmount !== undefined &&
    checkedAmount !== amountValue &&
    new BigNumber(checkedAmount).gt(balance) &&
    !isInsufficientBalance;
  const isCheckAmountMessageError =
    amountValue?.length > 0 &&
    !!checkAmountMessage &&
    !isStaleOverBalanceMessage;

  const amountInputDisabled = useMemo(() => {
    return isDisabled || isStakingCapFull;
  }, [isDisabled, isStakingCapFull]);

  // Off for what the amount is, before the server's check of it
  const isDisableBeforeCheck = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0 ||
      isStakingCapFull
    );
  }, [
    amountValue,
    isCheckAmountMessageError,
    checkAmountAlerts.length,
    isInsufficientBalance,
    isStakingCapFull,
  ]);
  const isDisable = isDisableBeforeCheck || checkAmountLoading;

  const daysSpent = useMemo(() => {
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const onSubmit = useCallback(async () => {
    Keyboard.dismiss();

    // Bot Wallet deactivated warning
    const isDeactivatedBot = await isAccountIdDeactivatedBotWallet({
      accountId,
    });
    if (isDeactivatedBot) {
      const confirmed = await showBotWalletDeactivatedWarningDialog();
      if (!confirmed) {
        return;
      }
    }

    // OK-59196: Stakefish signs a provider-facing message before any hook runs,
    // so the disclaimer has to gate this pre-transaction step. Not a duplicate
    // of the gate inside useUniversalStake — that one only covers the transaction
    // itself, and once accepted this call resolves immediately. Only create-new
    // validator stakes sign, so a top up never reaches this dialog.
    if (isStakefishCreateNewValidator && !stakefishPermitSignatureRef.current) {
      const riskAcceptedBeforeSigning = await showEarnRiskWarningDialog({
        provider: providerName,
        symbol: actionSymbol,
        networkId,
        title: intl.formatMessage({ id: ETranslations.global_warning }),
      });
      if (!riskAcceptedBeforeSigning) {
        return;
      }
    }

    // Stakefish ETH: sign before building the staking transaction. Only the
    // create-new-validator flow needs it; the Earn API routes a top up by
    // publicKey (the selected validator) and the signature would take priority
    // over it in the stake build, so signing a top up only blocks the build.
    if (isStakefishCreateNewValidator && !stakefishPermitSignatureRef.current) {
      setApproving(true);
      try {
        const { signature, message } = await signPersonalMessage({
          networkId,
          accountId,
          provider: providerName,
          symbol: actionSymbol,
          amount: new BigNumber(amountValue).toFixed(),
          action: 'stake',
        });
        stakefishPermitSignatureRef.current = signature;
        stakefishPermitMessageRef.current = message;
      } catch (error) {
        console.error('Stakefish permit sign error:', error);
        setApproving(false);
        return;
      }
      setApproving(false);
    }

    // Determine permitSignature source: Morpho uses permitSignatureRef, Stakefish uses stakefishPermitSignatureRef.
    // Stakefish only attaches it for a new validator; a top up must stay
    // signature-free so the Earn API routes it by publicKey.
    let finalPermitSignature: string | undefined;
    let finalMessage: string | undefined;
    let finalUnsignedMessage: IEarnPermit2ApproveSignData | undefined;
    if (usePermit2Approve) {
      finalPermitSignature = permitSignatureRef.current;
      finalUnsignedMessage = permit2DataRef.current;
    } else if (isStakefishCreateNewValidator) {
      finalPermitSignature = stakefishPermitSignatureRef.current;
      finalMessage = stakefishPermitMessageRef.current;
    }

    const permitSignatureParams = finalPermitSignature
      ? {
          approveType: usePermit2Approve ? approveType : undefined,
          permitSignature: finalPermitSignature,
          unsignedMessage: finalUnsignedMessage,
          message: finalMessage,
        }
      : undefined;

    // Stakefish specific params: validatorPubkey only for existing validator.
    const stakefishParams =
      isStakefishProvider && !isStakefishCreateNewValidator && selectedValidator
        ? { validatorPubkey: selectedValidator }
        : undefined;

    const resetAmount = () => {
      setAmountValue('');
      setCheckoutAmountMessage('');
      setCheckAmountAlerts([]);
      // Reset stakefish permit signature and message
      stakefishPermitSignatureRef.current = undefined;
      stakefishPermitMessageRef.current = undefined;
    };
    const handleConfirm = async () => {
      setSubmitting(true);
      try {
        if (isWrapStake) {
          let shouldShowApproveStep = true;
          try {
            const allowanceValue = await fetchPostWrapAllowance();
            shouldShowApproveStep =
              getShouldShowPostWrapApproveStep(allowanceValue);
          } catch {
            shouldShowApproveStep = true;
          }
          setShouldShowPostWrapApproveStepOverride(shouldShowApproveStep);
          setStakeProgressStep(EStakeProgressStep.approve);
        }

        const started = await onConfirm?.({
          amount: amountValue,
          effectiveApy: transactionConfirmation?.effectiveApy,
          stakeType,
          onStepChange: handleStakeProgressChange,
          ...permitSignatureParams,
          ...stakefishParams,
        });
        if (started === false) {
          return;
        }
        resetAmount();
        // Auto-refresh quote countdown after swap completes
        onQuoteReset?.();
      } finally {
        setSubmitting(false);
      }
    };

    // Check high price impact (Pendle only)
    if (isPendleProvider) {
      const payFiatValue =
        Number(amountValue) > 0 && Number(tokenInfo?.price) > 0
          ? new BigNumber(amountValue)
              .multipliedBy(tokenInfo?.price ?? '0')
              .toFixed()
          : undefined;
      const impactInfo = calcPriceImpactInfo({
        payFiatValue,
        receiveConfig: receiveInputConfig,
        receiveDescription: transactionConfirmation?.receive,
      });
      if (impactInfo) {
        const userConfirmed = await showHighPriceImpactDialog(intl, {
          percent: impactInfo.percent,
          lossAmount: `${currencySymbol}${impactInfo.lossAmount}`,
        });
        if (!userConfirmed) return;
      }
    }

    if (estimateFeeResp) {
      const daySpent =
        Number(estimateFeeResp?.coverFeeSeconds || 0) / 3600 / 24;

      if (daySpent && daySpent > 5) {
        showEstimateGasAlert({
          daysConsumed: formatStakingDistanceToNowStrict(
            estimateFeeResp.coverFeeSeconds,
          ),
          estFiatValue: estimateFeeResp.feeFiatValue,
          onConfirm: async (dialogInstance: IDialogInstance) => {
            await dialogInstance.close();
            await handleConfirm();
          },
        });
        return;
      }
    }

    if (!usePermit2Approve || (usePermit2Approve && !shouldApprove)) {
      await checkEstimateGasAlert(handleConfirm);
      return;
    }

    await handleConfirm();
  }, [
    usePermit2Approve,
    approveType,
    estimateFeeResp,
    shouldApprove,
    onConfirm,
    amountValue,
    showEstimateGasAlert,
    checkEstimateGasAlert,
    isStakefishProvider,
    isPendleProvider,
    selectedValidator,
    isStakefishCreateNewValidator,
    signPersonalMessage,
    networkId,
    accountId,
    actionSymbol,
    providerName,
    onQuoteReset,
    intl,
    currencySymbol,
    tokenInfo?.price,
    receiveInputConfig,
    transactionConfirmation?.effectiveApy,
    transactionConfirmation?.receive,
    stakeType,
    isWrapStake,
    fetchPostWrapAllowance,
    getShouldShowPostWrapApproveStep,
    handleStakeProgressChange,
  ]);

  const showStakeProgressRef = useRef<Record<string, boolean>>({});

  // Holds the latest onApprove so the USDT reset flow (defined before onApprove)
  // can re-enter the approve step once the allowance has been reset to 0.
  const onApproveRef = useRef<(() => Promise<void>) | undefined>(undefined);
  // Whitelist flag for the deliberate USDT-reset re-entry (OK-58027): that
  // flow re-enters onApprove while approving === true, so the reentry guard
  // must let it through (review P0). A ref (not a param) keeps onApprove
  // zero-arg — it is passed directly to the footer button's onPress, where a
  // press event would otherwise land in the options slot.
  const usdtResetReentryRef = useRef(false);

  const resetUSDTApproveValue = useCallback(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });
    const approveResetInfo: IApproveInfo = {
      owner: account.address,
      spender: approveTarget.spenderAddress,
      amount: '0',
      isMax: false,
      tokenInfo: {
        ...tokenInfo?.token,
        address: tokenInfo?.token.address ?? '',
        symbol: tokenInfo?.token.symbol ?? '',
        decimals: tokenInfo?.token.decimals ?? 0,
        isNative: !!tokenInfo?.token.isNative,
        name: tokenInfo?.token.name ?? (tokenInfo?.token.symbol || ''),
      },
    };
    const approvesInfo = [approveResetInfo];
    await navigationToTxConfirm({
      approvesInfo,
      onSuccess() {
        // Poll for allowance updates until it becomes 0
        const pollAllowanceUntilZero = async () => {
          try {
            let attempts = 0;
            const maxAttempts = 10; // Prevent infinite polling
            const pollInterval = 3000; // 3 seconds between polls

            const checkAllowance = async () => {
              // Fetch latest allowance
              const allowanceInfo = await fetchAllowanceResponse();

              if (allowanceInfo) {
                // Allowance is now 0: the USDT reset landed on-chain. Re-enter
                // the approve step to continue the flow (approve the new amount
                // then submit the stake). onApprove re-reads the allowance, sees
                // 0, and skips the reset branch — no loop. Without this the flow
                // dead-ended right after the reset tx, so the stake never fired
                // (OK-58027). Keep approving=true; onApprove owns the state from
                // here — but observe rejections: onApprove awaits getAccount /
                // navigationToTxConfirm outside any try/catch, and a swallowed
                // reject would leave the confirm button stuck loading+disabled.
                if (BigNumber(allowanceInfo.allowanceParsed).isZero()) {
                  // Bypass the approving-reentry guard: this deliberate
                  // re-entry runs with approving === true (OK-58027)
                  usdtResetReentryRef.current = true;
                  void onApproveRef.current?.().catch((e) => {
                    console.error(
                      'Re-enter approve after USDT reset failed:',
                      e,
                    );
                    setApproving(false);
                  });
                  return;
                }
              }

              attempts += 1;

              if (attempts < maxAttempts) {
                setTimeout(checkAllowance, pollInterval);
              } else {
                setApproving(false);
              }
            };

            // Start the recursive polling
            setTimeout(checkAllowance, pollInterval);
          } catch (error) {
            console.error('Error polling for allowance:', error);
            setApproving(false);
          }
        };

        // Start polling for USDT reset
        void pollAllowanceUntilZero();
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    fetchAllowanceResponse,
    navigationToTxConfirm,
    tokenInfo?.token,
  ]);

  const showResetUSDTApproveValueDialog = useCallback(() => {
    Dialog.show({
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      showExitButton: false,
      dismissOnOverlayPress: false,
      onCancel: () => {
        setApproving(false);
      },
      onConfirm: () => {
        void resetUSDTApproveValue();
      },
      title: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
      }),
      icon: 'ErrorOutline',
    });
  }, [intl, resetUSDTApproveValue]);

  const waitForAllowanceAfterApprove = useCallback(
    async ({
      requiredAmount,
      maxAttempts = 15,
      intervalMs = 2000,
      signal,
    }: {
      requiredAmount: string;
      maxAttempts?: number;
      intervalMs?: number;
      signal?: AbortSignal;
    }) => {
      if (
        !useApprove ||
        usePermit2Approve ||
        tokenInfo?.token?.isNative ||
        !requiredAmount
      ) {
        return true;
      }

      const requiredAmountBN = new BigNumber(requiredAmount);
      if (requiredAmountBN.isNaN() || requiredAmountBN.lte(0)) {
        return true;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return false;
        }
        try {
          const allowanceInfo = await fetchAllowanceResponse();
          const allowanceBN = new BigNumber(
            allowanceInfo.allowanceParsed || '0',
          );
          if (!allowanceBN.isNaN() && allowanceBN.gte(requiredAmountBN)) {
            return true;
          }
        } catch (error) {
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, intervalMs);
          });
        }
      }

      return false;
    },
    [
      useApprove,
      usePermit2Approve,
      tokenInfo?.token?.isNative,
      fetchAllowanceResponse,
    ],
  );

  const onApprove = useCallback(async () => {
    Keyboard.dismiss();
    // Take the approving lock synchronously BEFORE any await (review P1):
    // the confirm button's loading derives from `approving`, so awaiting
    // first would leave a double-tap window as wide as one bg IPC roundtrip.
    // The USDT reset flow (OK-58027) re-enters deliberately with
    // approving === true, so it is whitelisted via usdtResetReentryRef —
    // blocking it would dead-end the flow with the button stuck loading
    // (review P0)
    const isUsdtResetReentry = usdtResetReentryRef.current;
    usdtResetReentryRef.current = false;
    if (approving && !isUsdtResetReentry) {
      return;
    }
    setApproving(true);
    // OK-59196: the approve step is the user's first on-chain action in the
    // two-step flow and bypasses useUniversalStake, so the one-time risk
    // disclaimer must gate here too (once accepted it resolves immediately)
    const riskConfirmed = await showEarnRiskWarningDialog({
      provider: providerName,
      symbol: actionSymbol,
      networkId: approveTarget.networkId,
      title: intl.formatMessage({ id: ETranslations.global_warning }),
    });
    if (!riskConfirmed) {
      setApproving(false);
      return;
    }
    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch (e) {
      console.error(e);
    }
    permitSignatureRef.current = undefined;
    permit2DataRef.current = undefined;
    showStakeProgressRef.current[amountValue] = true;

    const allowanceBN = BigNumber(approveAllowance);
    const amountBN = BigNumber(amountValue);

    if (tokenInfo?.token && earnUtils.isUSDTonETHNetwork(tokenInfo?.token)) {
      if (allowanceBN.gt(0) && amountBN.gt(allowanceBN)) {
        showResetUSDTApproveValueDialog();
        return;
      }
    }

    if (usePermit2Approve) {
      const handlePermit2Approve = async () => {
        try {
          // Check permit cache first
          const permitCache = getPermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: tokenInfo?.token?.address ?? '',
            amount: amountValue,
          });

          if (permitCache) {
            permitSignatureRef.current = permitCache.signature;
            permit2DataRef.current = permitCache.permit2Data;
            void onSubmit();
            setApproving(false);
            return;
          }

          const { signature, unsignedMessage } = await getPermitSignature({
            networkId: approveTarget.networkId,
            accountId: approveTarget.accountId,
            token: tokenInfo?.token as IToken,
            amountValue,
            providerName,
            vaultAddress: approveTarget.spenderAddress,
          });
          permitSignatureRef.current = signature;
          permit2DataRef.current = unsignedMessage;

          // Update permit cache
          updatePermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: tokenInfo?.token?.address ?? '',
            amount: amountValue,
            signature,
            permit2Data: unsignedMessage,
            expiredAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          });

          const freshFee = await fetchEstimateFeeResp(amountValue);
          setEstimateFeeResp(freshFee);
          setEstimateFeeAmount(amountValue);

          await onSubmit();
          setApproving(false);
        } catch (error: unknown) {
          console.error('Permit sign error:', error);
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
          setApproving(false);
        }
      };

      void checkEstimateGasAlert(handlePermit2Approve);
      return;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });

    await navigationToTxConfirm({
      approvesInfo: [
        {
          owner: account.address,
          spender: approveTarget.spenderAddress,
          amount: amountValue,
          tokenInfo: approveTarget.token,
        },
      ],
      onSuccess(data) {
        trackAllowance(data[0].decodedTx.txid);
        allowanceAbortRef.current?.abort();
        const abortController = new AbortController();
        allowanceAbortRef.current = abortController;
        void (async () => {
          try {
            const allowanceReady = await waitForAllowanceAfterApprove({
              requiredAmount: amountValue,
              signal: abortController.signal,
            });
            if (!allowanceReady) {
              return;
            }
            const freshFee = await fetchEstimateFeeResp(amountValue);
            setEstimateFeeResp(freshFee);
            setEstimateFeeAmount(amountValue);
            await onSubmit();
          } finally {
            setApproving(false);
          }
        })();
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [
    approving,
    allowance,
    amountValue,
    tokenInfo?.token,
    usePermit2Approve,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    approveTarget.token,
    navigationToTxConfirm,
    fetchAllowanceResponse,
    showResetUSDTApproveValueDialog,
    checkEstimateGasAlert,
    getPermitCache,
    getPermitSignature,
    providerName,
    actionSymbol,
    updatePermitCache,
    onSubmit,
    waitForAllowanceAfterApprove,
    fetchEstimateFeeResp,
    trackAllowance,
    intl,
  ]);

  // Keep the ref pointing at the latest onApprove so the earlier-defined USDT
  // reset flow can re-enter it after the allowance is zeroed.
  useEffect(() => {
    onApproveRef.current = onApprove;
  }, [onApprove]);

  const {
    isPendleLikeLayout,
    apyDetail,
    pendleTipText,
    showExpiredRefresh,
    showReceiveInput,
    effectiveReceiveInputConfig,
  } = usePendleLayoutState({
    providerName,
    transactionConfirmation,
    amountValue,
    showApyDetail,
    receiveInputConfig,
    networkLogoURI,
    isQuoteExpired,
    loading: quoteLoading,
  });

  // During approve/submit flow, don't show expired refresh — the transaction is in progress.
  // After swap completes, onQuoteReset will restart the countdown.
  const isTransacting = approving || submitting;
  const effectiveShowExpiredRefresh = showExpiredRefresh && !isTransacting;

  const isPositiveAmount = useMemo(() => {
    const amountBN = new BigNumber(amountValue);
    return !amountBN.isNaN() && amountBN.gt(0);
  }, [amountValue]);
  // A box emptied keeps what was on screen a moment (the figures dimmed, or
  // the placeholders of a quote on its way), so a digit deleted and typed
  // again is a change rather than a blink or a restart; left empty, the rows
  // and the line under the box go back to dashes together, and the next
  // amount starts from placeholders rather than the last amount's figures
  const [wasPositiveAmount, setWasPositiveAmount] = useState(isPositiveAmount);
  const [isEmptiedHolding, setIsEmptiedHolding] = useState(false);
  if (wasPositiveAmount !== isPositiveAmount) {
    setWasPositiveAmount(isPositiveAmount);
    setIsEmptiedHolding(!isPositiveAmount);
  }
  useEffect(() => {
    if (isPositiveAmount) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setShownQuote(EMPTY_SHOWN_QUOTE);
      setReceiveQuote(undefined);
      setIsEmptiedHolding(false);
    }, QUOTE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isPositiveAmount]);
  // The rows keep their places in every state: the shown quote's figures,
  // else the labels of the last quote (or of the server's empty-amount
  // answer) with dashes, or placeholders while a quote is coming
  const isRowsPlaceholder = !shownQuote.confirmation;
  const rowsConfirmation =
    shownQuote.confirmation ??
    lastConfirmationRef.current ??
    emptyAmountConfirmation;
  // From the keystroke until this amount's quote is in: the figures shown
  // are the last amount's, dimmed. Through an emptied box's moment what was
  // on screen waits too
  const isQuoteUpdating =
    (isPositiveAmount ? amountValue : '') !== shownQuote.amount ||
    isEmptiedHolding;

  const pendleRows = useMemo(
    () =>
      splitPendleRewardRows(
        isPendleLikeLayout
          ? (rowsConfirmation?.rewards ?? []).filter(
              (reward) =>
                !!reward?.title?.text?.trim() &&
                !!reward?.description?.text?.trim(),
            )
          : [],
      ),
    [isPendleLikeLayout, rowsConfirmation?.rewards],
  );
  const pendleDetailRows = usePendleTransactionDetails({
    transactionConfirmation: rowsConfirmation,
    // The amount the shown figures are for: they stay while the box is
    // emptied a moment
    amountValue: shownQuote.amount,
    isPendleLikeLayout,
    placeholder: isRowsPlaceholder,
  });

  const pendleAnswerRows = useMemo(() => {
    if (!isPendleLikeLayout) {
      return undefined;
    }
    const details =
      rowsConfirmation?.transactionDetails?.data?.transactionDetails?.filter(
        (detail) => !!detail?.title?.text,
      ) ?? [];
    const rows = [
      ...pendleRows.detailRows.map((row) => ({
        title: row.title.text,
        tooltip: row.tooltip,
      })),
      ...details.map((detail) => ({
        title: detail.title.text,
        tooltip: detail.tooltip,
      })),
    ];
    return rows.length ? rows.slice(0, SHOWN_ROWS_WHEN_FOLDED) : undefined;
  }, [
    isPendleLikeLayout,
    pendleRows.detailRows,
    rowsConfirmation?.transactionDetails?.data?.transactionDetails,
  ]);
  if (pendleAnswerRows) {
    lastPendleRows = pendleAnswerRows;
  }
  const isPendleRowsReserved = isPendleLikeLayout && !pendleAnswerRows;

  // Whether this protocol's quotes carry rewards at all: one that doesn't
  // leaves the result out, rather than a dash that never fills
  const quoteHasRewardsRef = useRef<boolean | undefined>(undefined);
  if (shownQuote.confirmation && !isQuoteUpdating) {
    quoteHasRewardsRef.current = hasStakingRewardsSummary({
      transactionConfirmation: shownQuote.confirmation,
    });
  }

  let outcome: IEarnOutcome | undefined;
  if (isPendleLikeLayout) {
    const { outcomeRow } = pendleRows;
    const outcomeValue = isRowsPlaceholder
      ? undefined
      : buildOutcomeValueFromText(outcomeRow?.description);
    outcome = {
      label:
        outcomeRow?.title.text.trim() ||
        EARN_DESKTOP_DEMO_COPY.atMaturityYouGet,
      tooltip: outcomeRow?.tooltip,
      values: outcomeValue ? [outcomeValue] : [],
      isEarning: true,
      // Under the amount at maturity, the gain
      hasNoteLine: true,
    };
  } else if (quoteHasRewardsRef.current !== false) {
    outcome = buildRewardsOutcome({
      transactionConfirmation: rowsConfirmation,
      placeholderLabel: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
      withoutValues: isRowsPlaceholder,
    });
  }

  const { shownFee, isFeeLoading } = useEarnFeeFigure({
    fee: estimateFeeResp,
    feeAmount: estimateFeeAmount,
    amountValue,
    isPositiveAmount,
    hasShownFigures: shownQuote.amount !== '' || isEmptiedHolding,
  });

  const summaryRows = useMemo(() => {
    const items: ReactElement[] = [];
    if (isPendleRowsReserved) {
      const reservedRows: { title: string; tooltip?: IEarnTooltip }[] =
        lastPendleRows ??
        EARN_DESKTOP_DEMO_COPY.pendleRowTitles.map((title) => ({ title }));
      // Keyed by label, as the answered rows are: each becomes the same
      // row with its figure, which fades in where its placeholder was
      const reservedKeys = buildRowKeys(reservedRows.map((row) => row.title));
      reservedRows.forEach((row, index) => {
        items.push(
          <EarnFormRow
            key={reservedKeys[index]}
            label={row.title}
            tooltip={row.tooltip}
          />,
        );
      });
      return items;
    }
    if (isPendleLikeLayout) {
      const rewardKeys = buildRowKeys(
        pendleRows.detailRows.map((reward) => reward.title.text),
      );
      pendleRows.detailRows.forEach((reward, index) => {
        items.push(
          <EarnFormRow
            key={rewardKeys[index]}
            label={reward.title.text}
            tooltip={reward.tooltip}
            value={
              isRowsPlaceholder ? undefined : (
                <EarnText
                  text={reward.description}
                  size="$bodyMdMedium"
                  textAlign="right"
                />
              )
            }
          />,
        );
      });
      items.push(...pendleDetailRows);
      return items;
    }
    items.push(
      ...buildRewardNoteRows({
        transactionConfirmation: rowsConfirmation,
        withoutValues: isRowsPlaceholder,
      }),
    );
    const receive = rowsConfirmation?.receive;
    if (receive) {
      items.push(
        <EarnFormRow
          key="receive"
          label={receive.title.text}
          tooltip={receive.tooltip}
          value={
            isRowsPlaceholder ? undefined : (
              <EarnText
                text={receive.description}
                size="$bodyMdMedium"
                textAlign="right"
              />
            )
          }
        />,
      );
    }
    // A zero estimate counts as none
    if (shownFee) {
      items.push(
        <EarnFormRow
          key="network-fee"
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
          isLoading={isFeeLoading}
          value={
            <XStack
              ai="center"
              mr={-6}
              cursor="pointer"
              onPress={() => {
                showEstimateGasAlert({
                  daysConsumed: daysSpent,
                  estFiatValue: shownFee.feeFiatValue,
                });
              }}
            >
              <NumberSizeableText
                size="$bodyMdMedium"
                formatter="value"
                formatterOptions={{ currency: currencySymbol }}
              >
                {shownFee.feeFiatValue}
              </NumberSizeableText>
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          }
        />,
      );
    } else if (!usePermit2Approve) {
      // Held in place until this amount's estimate is in, so the button
      // doesn't move on the first digit; the same row as the fee's, which
      // fades in where its placeholder was. A permit deposit has no
      // estimate to wait for (it signs a permit first), so it holds no row
      items.push(
        <EarnFormRow
          key="network-fee"
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
          isLoading={isFeeLoading}
        />,
      );
    }
    return items;
  }, [
    currencySymbol,
    daysSpent,
    shownFee,
    isFeeLoading,
    intl,
    usePermit2Approve,
    isPendleLikeLayout,
    isPendleRowsReserved,
    isRowsPlaceholder,
    pendleDetailRows,
    pendleRows.detailRows,
    rowsConfirmation,
    showEstimateGasAlert,
  ]);
  const showBtcFeeRateInput =
    providerName?.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase() &&
    Boolean(estimateFeeUTXO) &&
    isPositiveAmount;
  // The steps show once the button is pressed, not before: the button
  // already names them ("Approve and Deposit")
  const isStakeRunning =
    approving ||
    submitting ||
    Boolean(showStakeProgressRef.current[amountValue]) ||
    (isWrapStake && stakeProgressStep > EStakeProgressStep.approve);
  const isShowStakeProgress =
    isPositiveAmount &&
    isStakeRunning &&
    (isWrapStake ||
      (useApprove &&
        (shouldApprove || showStakeProgressRef.current[amountValue])));

  const stakeProgressCurrentStep = useMemo(() => {
    if (isWrapStake) {
      return stakeProgressStep;
    }
    if (isDisable || shouldApprove) {
      return EStakeProgressStep.approve;
    }
    return EStakeProgressStep.deposit;
  }, [isDisable, isWrapStake, shouldApprove, stakeProgressStep]);
  const stakeProgress = (
    <StakeProgress
      approveType={approveType}
      currentStep={stakeProgressCurrentStep}
      step1Label={isWrapStake ? wrapStakeLabel : undefined}
      // Plain "Approve", also when it is a signature (permit)
      step1LabelId={ETranslations.global_approve}
      step2LabelId={stakeProgressStep2LabelId}
      step3LabelId={stakeProgressStep3LabelId}
      isRunning={approving || submitting}
    />
  );

  const onConfirmText = useMemo(() => {
    if (effectiveShowExpiredRefresh) {
      return intl.formatMessage({ id: ETranslations.global_refresh });
    }
    if (!useApprove) {
      if (isWrapStake) {
        return wrapStakeLabel;
      }
      return intl.formatMessage({
        id: isPendleProvider
          ? ETranslations.global_buy
          : ETranslations.global_continue,
      });
    }
    if (shouldApprove) {
      // One press approves, then deposits or buys by itself once the
      // approval is on chain, so the button names both
      if (isPendleProvider) {
        return EARN_DESKTOP_DEMO_COPY.approveAnd(
          intl.formatMessage({ id: ETranslations.global_buy }),
        );
      }
      return intl.formatMessage(
        { id: ETranslations.earn_approve_deposit },
        { amount: amountValue, symbol: tokenInfo?.token.symbol || '' },
      );
    }
    return intl.formatMessage({
      id: isPendleProvider
        ? ETranslations.global_buy
        : ETranslations.earn_deposit,
    });
  }, [
    effectiveShowExpiredRefresh,
    useApprove,
    shouldApprove,
    intl,
    isWrapStake,
    wrapStakeLabel,
    amountValue,
    tokenInfo?.token.symbol,
    isPendleProvider,
  ]);

  const confirmOnPress = useMemo(() => {
    if (effectiveShowExpiredRefresh) return handleLocalRefreshQuote;
    if (shouldApprove) return onApprove;
    return onSubmit;
  }, [
    effectiveShowExpiredRefresh,
    shouldApprove,
    handleLocalRefreshQuote,
    onApprove,
    onSubmit,
  ]);

  const overridesState =
    footerActionOverride && !footerActionOverride.isPressOnly;
  // While another protocol loads, the button waits under its own words
  const effectiveOnConfirmText =
    overridesState && !footerActionOverride.isSwitchWait
      ? footerActionOverride.text
      : onConfirmText;
  const effectiveConfirmOnPress =
    footerActionOverride?.onPress ?? confirmOnPress;
  const baseConfirmLoading = effectiveShowExpiredRefresh
    ? quoteRefreshing
    : loadingAllowance || approving || submitting || checkAmountLoading;
  const baseConfirmDisabled = effectiveShowExpiredRefresh ? false : isDisable;
  const effectiveConfirmLoading = footerActionOverride
    ? Boolean(footerActionOverride.loading)
    : baseConfirmLoading;
  const effectiveConfirmDisabled = overridesState
    ? Boolean(footerActionOverride.disabled)
    : baseConfirmDisabled;

  // The server checks the amount a moment after each keystroke. The button
  // keeps its look meanwhile (no spinner, no grey that comes and goes); a
  // press in that moment goes once the check passes
  const [isPressWaitingCheck, setIsPressWaitingCheck] = useState(false);
  const isOwnButtonState =
    !footerActionOverride && !effectiveShowExpiredRefresh;
  const buttonLoading = isOwnButtonState
    ? isPressWaitingCheck || loadingAllowance || approving || submitting
    : effectiveConfirmLoading;
  const buttonDisabled = isOwnButtonState
    ? isDisableBeforeCheck
    : effectiveConfirmDisabled;
  const isSwitchingOffer = useContext(EarnFormSwitchingContext);
  const handleConfirmPress = useCallback(() => {
    // Picked another protocol a moment ago: this form is the one being left
    if (isSwitchingOffer) {
      return;
    }
    if (isOwnButtonState && checkAmountLoading) {
      setIsPressWaitingCheck(true);
      return;
    }
    void effectiveConfirmOnPress();
  }, [
    checkAmountLoading,
    effectiveConfirmOnPress,
    isOwnButtonState,
    isSwitchingOffer,
  ]);
  useEffect(() => {
    if (!isPressWaitingCheck || checkAmountLoading) {
      return;
    }
    setIsPressWaitingCheck(false);
    if (!effectiveConfirmDisabled && !effectiveConfirmLoading) {
      void effectiveConfirmOnPress();
    }
  }, [
    checkAmountLoading,
    effectiveConfirmDisabled,
    effectiveConfirmLoading,
    effectiveConfirmOnPress,
    isPressWaitingCheck,
  ]);

  const autoSubmittedKeyRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      autoSubmitKey === undefined ||
      autoSubmittedKeyRef.current === autoSubmitKey ||
      checkedAmount !== amountValue ||
      effectiveShowExpiredRefresh ||
      effectiveConfirmDisabled ||
      effectiveConfirmLoading
    ) {
      return;
    }
    autoSubmittedKeyRef.current = autoSubmitKey;
    onAutoSubmit?.();
    void effectiveConfirmOnPress();
  }, [
    amountValue,
    autoSubmitKey,
    checkedAmount,
    effectiveConfirmDisabled,
    effectiveConfirmLoading,
    effectiveConfirmOnPress,
    effectiveShowExpiredRefresh,
    onAutoSubmit,
  ]);

  const footerContent = (
    <YStack bg="$bgApp" gap="$5">
      {isShowStakeProgress ? <Stack>{stakeProgress}</Stack> : null}
      <Page.FooterActions
        p={0}
        onConfirmText={effectiveOnConfirmText}
        buttonContainerProps={{
          $gtMd: {
            ml: '0',
          },
          w: '100%',
        }}
        confirmButtonProps={{
          onPress: handleConfirmPress,
          loading: buttonLoading,
          disabled: buttonDisabled,
          w: '100%',
        }}
      />
    </YStack>
  );

  const tradeOrBuyContent =
    isPendleProvider || hideTradeOrBuy ? null : (
      <TradeOrBuy
        token={tokenInfo?.token as IToken}
        accountId={accountId}
        networkId={networkId}
        containerStyle={{
          pt: '$0',
        }}
      />
    );

  const platformBonus = suppressPlatformBonus
    ? undefined
    : transactionConfirmation?.platformBonus;
  const shouldShowPlatformBonus = Boolean(platformBonus);

  const platformBonusContent = platformBonus ? (
    <EarnPlatformBonusSection
      platformBonus={platformBonus}
      protocolInfo={protocolInfo}
      tokenInfo={tokenInfo}
      footer={tradeOrBuyContent}
    />
  ) : null;

  // What the amount buys (Pendle's Buy): nothing before an amount, a
  // skeleton until a quote for this very amount is in, a dash without one.
  // A box emptied keeps the last figure a moment (dimmed), as the rows do
  const receiveSymbol = effectiveReceiveInputConfig?.tokenSymbol ?? '';
  // With the amount over the balance, or turned down by the server's check,
  // the red line stands in the line's place: the figure quoted then was
  // never on screen, so coming back the line waits for the next one with a
  // placeholder rather than showing that one, dimmed, as the last
  const isLineCovered =
    isPositiveAmount &&
    !isDisabled &&
    (isInsufficientBalance || isCheckAmountMessageError);
  const lineQuote =
    receiveQuote &&
    (receiveQuote.amount === lineShownAmountRef.current ||
      (receiveQuote.amount === amountValue && !isLineCovered))
      ? receiveQuote
      : undefined;
  const isReceiveSettling = isEmptiedHolding;
  // Dimmed until this amount's figure is in, as the rows are
  const isReceiveQuoting =
    (isPositiveAmount && lineQuote?.amount !== amountValue) ||
    isReceiveSettling;
  let receiveLine = '–';
  if (isPositiveAmount || isReceiveSettling) {
    const bought = earnUtils.extractAmountFromText(lineQuote?.description);
    receiveLine = new BigNumber(bought).gt(0)
      ? `≈ ${numberFormat(bought, { formatter: 'balance' })} ${receiveSymbol}`
      : '–';
  }
  const isReceiveLinePlaceholder = !receiveLine.startsWith('≈');
  if (!isReceiveLinePlaceholder && !isLineCovered) {
    lineShownAmountRef.current = lineQuote?.amount;
  }

  // What is wrong with the amount, as one red line under the box: the
  // server's check, else more than the balance
  // More than the balance reads the same whichever check says it first (the
  // server's own wording for it comes a moment later). A form still waiting
  // for its data (balance 0 for now) shows none
  let amountErrorText: string | undefined;
  if (isPositiveAmount && !isDisabled) {
    if (isInsufficientBalance) {
      amountErrorText = intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    } else if (isCheckAmountMessageError) {
      amountErrorText = checkAmountMessage;
    }
  }

  const summaryFootnote =
    pendleTipText || (!shouldShowPlatformBonus && tradeOrBuyContent) ? (
      <YStack gap="$3">
        {pendleTipText ? (
          <EarnText
            text={pendleTipText}
            size="$bodySm"
            color={pendleTipText.color ?? '$textInfo'}
          />
        ) : null}
        {shouldShowPlatformBonus ? null : tradeOrBuyContent}
      </YStack>
    ) : undefined;

  return (
    <StakingFormWrapper>
      {/* The lines under the box bring their own space, so a line that is
          not there leaves no gap */}
      <YStack>
        <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
          <StakingAmountInput
            title={
              inputTitle ||
              intl.formatMessage({ id: ETranslations.earn_deposit })
            }
            disabled={amountInputDisabled}
            hasError={Boolean(amountErrorText)}
            value={amountValue}
            onChange={onChangeAmountValue}
            onBlur={onBlurAmountValue}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: tokenImageUri,
              selectedTokenImageLoading: tokenImageLoading,
              selectedTokenSymbol: tokenSymbol,
              selectedNetworkImageUri: networkLogoURI,
              ...tokenSelectorTriggerProps,
            }}
            balanceProps={{
              value: balance,
              onPress: onMax,
              // During a protocol switch the on-screen balance still belongs
              // to the previous protocol/network — show the built-in balance
              // skeleton instead of a stale value that jumps on load. The
              // deposit modal's switch keeps the token and network, so its
              // balance stays
              loading:
                Boolean(balanceLoading) ||
                (Boolean(footerActionOverride?.loading) && !offerSwitch),
            }}
            inputProps={{
              placeholder: '0',
              autoFocus: !amountInputDisabled,
            }}
            valueProps={{
              value: currentValue,
              // "$0.00" before an amount, as on the Swap page
              currency: currencySymbol,
            }}
            enableMaxAmount
            onSelectPercentageStage={onSelectPercentageStage}
            bottomContent={amountBoxBottom}
            boxTestID={amountBoxTestID}
            onRefreshBalance={onRefreshBalance}
          />
          {amountInputDisabled ? (
            <Stack position="absolute" w="100%" h="100%" zIndex={1} />
          ) : null}
        </Stack>
        {closesDepositLineRoom ? (
          <ClosingRoom height={DEPOSIT_LINE_HEIGHT} />
        ) : null}
        {showReceiveInput ? (
          // Pendle's line, and in its place what is wrong with the amount,
          // as on the swap path: the line keeps its room, so nothing under
          // it moves; a longer message opens the room for its second line
          <HeightTransition duration={AMOUNT_LINE_MS} skipInitialAnimation>
            <YStack pt="$2">
              {amountErrorText ? (
                <SizableText
                  testID="earn-amount-error"
                  px="$3.5"
                  size="$bodyMd"
                  color="$textCritical"
                >
                  {amountErrorText}
                </SizableText>
              ) : (
                <StakingAmountResultLine
                  testID="earn-pendle-receive-amount"
                  label={intl.formatMessage({
                    id: ETranslations.swap_review_you_receive,
                  })}
                  value={receiveLine}
                  isPlaceholder={isReceiveLinePlaceholder}
                  loading={isReceiveQuoting}
                />
              )}
            </YStack>
          </HeightTransition>
        ) : (
          <HeightTransition duration={AMOUNT_LINE_MS}>
            {amountErrorText ? (
              <YStack pt="$2" px="$3.5">
                <SizableText
                  testID="earn-amount-error"
                  size="$bodyMd"
                  color="$textCritical"
                >
                  {amountErrorText}
                </SizableText>
              </YStack>
            ) : null}
          </HeightTransition>
        )}
      </YStack>
      {/* Where it goes: the protocol, and a validator where there is one */}
      {protocolSwitchConfig ? (
        <ProtocolSwitcher
          tokenSymbol={actionSymbol}
          accountId={accountId}
          fallbackProviderName={providerName}
          fallbackProviderLogoUri={providerLogo}
          fallbackAprText={apyDetail?.description?.text}
          protocolSwitchConfig={protocolSwitchConfig}
          disabled={approving || submitting}
        />
      ) : (
        offerSwitch
      )}
      {ongoingValidator ? (
        <EarnValidatorSelect
          field={ongoingValidator}
          value={selectedValidator}
          onChange={setSelectedValidator}
          disabled={amountInputDisabled}
        />
      ) : null}
      {checkAmountAlerts.length > 0 ? (
        <>
          {checkAmountAlerts.map((alert, index) => (
            <Alert
              key={index}
              type="warning"
              renderTitle={() => {
                return <EarnText text={alert.text} size="$bodyMdMedium" />;
              }}
              action={
                alert.button
                  ? {
                      primary: alert.button.text.text,
                      onPrimaryPress: () => {
                        if (alert.button?.data?.link) {
                          handleOpenWebSite({
                            navigation,
                            useCurrentWindow: false,
                            webSite: {
                              url: alert.button.data.link,
                              title: alert.button.data.link,
                              logo: undefined,
                              sortIndex: undefined,
                            },
                          });
                        }
                      },
                    }
                  : undefined
              }
            />
          ))}
        </>
      ) : null}
      {/* What it gets you, then the transaction's own rows */}
      <EarnFormSummary
        outcome={outcome}
        isLoading={isQuoteUpdating}
        rows={summaryRows}
        footnote={summaryFootnote}
        detailsPlaceholder={isPendleRowsReserved}
      />
      {showBtcFeeRateInput && estimateFeeUTXO ? (
        <BtcFeeRateInput
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
        />
      ) : null}
      {platformBonusContent}
      {beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          <EarnFooterFade>
            <Stack
              bg="$bgApp"
              flexDirection="column"
              $gtMd={{
                flexDirection: 'row',
                alignItems: 'center',
                jc: 'space-between',
              }}
            >
              {isShowStakeProgress ? (
                <Stack pl="$5" $md={{ pt: '$5' }}>
                  {stakeProgress}
                </Stack>
              ) : (
                <Stack />
              )}
              <Page.FooterActions
                onConfirmText={effectiveOnConfirmText}
                confirmButtonProps={{
                  onPress: handleConfirmPress,
                  loading: buttonLoading,
                  disabled: buttonDisabled,
                }}
              />
            </Stack>
            <PercentageStageOnKeyboard
              onSelectPercentageStage={onSelectPercentageStage}
              reserveSpaceUntilKeyboardShown={!amountInputDisabled}
            />
          </EarnFooterFade>
        </Page.Footer>
      ) : (
        <YStack>{footerContent}</YStack>
      )}
    </StakingFormWrapper>
  );
}
