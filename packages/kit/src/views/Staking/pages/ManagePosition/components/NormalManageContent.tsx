import type { ReactNode } from 'react';
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Dialog,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import {
  EManagePageActionType,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  IEarnHistoryActionIcon,
  IEarnManagePageActionData,
  IEarnManagePageResponse,
  IEarnSelectField,
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { readConfirmWordId } from '../../../components/UniversalStake/earnConfirmWord';
import { warmWithdrawWaysOut } from '../../../components/UniversalWithdraw/warmWithdrawWaysOut';
import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useQuoteCountdown } from '../../../hooks/useQuoteCountdown';
import { EManagePositionType } from '../hooks/useManagePage';

import { HeaderRight } from './HeaderRight';
import { StakeSection } from './StakeSection';
import { WithdrawSection } from './WithdrawSection';

import type { IHeaderRightViewProps } from './HeaderRight';
import type {
  IManagePositionFooterAction,
  IManagePositionPayWith,
  IManagePositionProtocolSwitchConfig,
} from './ManagePositionContent';
import type { IWithdrawSuccessInfo } from './WithdrawSection';

type IBorrowAction = 'supply' | 'withdraw' | 'borrow' | 'repay';
type IManageActionData = IEarnManagePageActionData | undefined;

// Switching sides on the details page: the other side is put together out
// of sight, then the two cross-fade in place (the one on screen fading out
// over the other fading in) while the space they take eases from one's
// height to the other's, as the selected background slides between the tabs
const TAB_CONTENT_SWAP_MS = 250;
const TAB_CONTENT_HEIGHT_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
// Laid over the side in the flow, invisible (put together, or fading out)
const TAB_CONTENT_OVERLAY_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  pointerEvents: 'none',
  'aria-hidden': true,
} as const;
// The tabs' look before the background slid: no track, the selected one on
// a flat block
const TAB_ITEM_STYLE = {
  px: '$2',
  py: '$1.5',
  borderRadius: '$2',
} as const;

function useTabContentFade(selectedIndex: number, enabled: boolean) {
  const reduceMotion = useReducedMotion();
  const animates = enabled && !reduceMotion;
  const [shownIndex, setShownIndex] = useState(selectedIndex);
  // The other side is put together out of sight first (a form takes a few
  // frames to mount), so it can fade in whole
  const [preparedIndex, setPreparedIndex] = useState<number>();
  // The side that was on screen, fading out over the new one
  const [leavingIndex, setLeavingIndex] = useState<number>();
  useEffect(() => {
    if (!animates) {
      setShownIndex(selectedIndex);
      setPreparedIndex(undefined);
      setLeavingIndex(undefined);
      return undefined;
    }
    if (shownIndex === selectedIndex) {
      setPreparedIndex(undefined);
      return undefined;
    }
    // Once the tab's first frame is drawn, and rendered in slices, so the
    // tab's slide keeps its frames while the side mounts
    let prepareTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      prepareTimer = setTimeout(() =>
        startTransition(() => setPreparedIndex(selectedIndex)),
      );
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(prepareTimer);
    };
  }, [animates, selectedIndex, shownIndex]);
  // The prepared side drawn: the two swap places
  useEffect(() => {
    if (
      !animates ||
      preparedIndex === undefined ||
      preparedIndex !== selectedIndex ||
      preparedIndex === shownIndex
    ) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      setLeavingIndex(shownIndex);
      setShownIndex(preparedIndex);
      setPreparedIndex(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [animates, preparedIndex, selectedIndex, shownIndex]);
  useEffect(() => {
    if (leavingIndex === undefined) {
      return undefined;
    }
    const timer = setTimeout(
      () => setLeavingIndex(undefined),
      TAB_CONTENT_SWAP_MS,
    );
    return () => clearTimeout(timer);
  }, [leavingIndex]);
  const index = animates ? shownIndex : selectedIndex;
  return {
    shownIndex: index,
    preparedIndex:
      animates && preparedIndex !== index ? preparedIndex : undefined,
    leavingIndex:
      animates && leavingIndex !== index && leavingIndex !== preparedIndex
        ? leavingIndex
        : undefined,
    animates,
  };
}

// The sides come in as elements made by the parent: its timing state lives
// here, so a swap re-renders this alone and the forms are left as they are
function TabContentFade({
  selectedIndex,
  enabled,
  sides,
}: {
  selectedIndex: number;
  enabled: boolean;
  sides: ReactNode[];
}) {
  const { shownIndex, preparedIndex, leavingIndex, animates } =
    useTabContentFade(selectedIndex, enabled);
  // The space the sides take, eased from the one that was on screen to the
  // one now there (web)
  const containerRef = useRef<IElement>(null);
  const shownHeightRef = useRef(0);
  const lastShownIndexRef = useRef(shownIndex);
  useLayoutEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!platformEnv.isRuntimeBrowser || !container) {
      return undefined;
    }
    const from = shownHeightRef.current;
    const isSwap = lastShownIndexRef.current !== shownIndex;
    lastShownIndexRef.current = shownIndex;
    const to = container.offsetHeight;
    shownHeightRef.current = to;
    if (!isSwap || !animates || !from || from === to) {
      return undefined;
    }
    container.style.transition = 'none';
    container.style.height = `${from}px`;
    // Drawn at the old height first, then eased to the new one
    void container.offsetHeight;
    container.style.transition = `height ${TAB_CONTENT_SWAP_MS}ms ${TAB_CONTENT_HEIGHT_EASING}`;
    container.style.height = `${to}px`;
    const timer = setTimeout(() => {
      container.style.transition = '';
      container.style.height = '';
    }, TAB_CONTENT_SWAP_MS);
    return () => {
      clearTimeout(timer);
      container.style.transition = '';
      container.style.height = '';
    };
  }, [animates, shownIndex]);
  // Kept up to date between swaps (rows coming in, a line opening)
  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!platformEnv.isRuntimeBrowser || !container) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (!container.style.height) {
        shownHeightRef.current = container.offsetHeight;
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  if (!animates) {
    return <>{sides[selectedIndex]}</>;
  }
  return (
    <YStack ref={containerRef}>
      {[shownIndex, leavingIndex, preparedIndex]
        .filter((index): index is number => index !== undefined)
        .toSorted((a, b) => a - b)
        .map((index) => {
          const isShown = index === shownIndex;
          return (
            <YStack
              key={index}
              {...(isShown ? null : TAB_CONTENT_OVERLAY_STYLE)}
              // The prepared side mounts invisible (a first value doesn't
              // animate); the other two cross-fade. The transition is there
              // from the first frame: one added later would draw the view
              // again with more hooks
              opacity={isShown ? 1 : 0}
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
            >
              {sides[index]}
            </YStack>
          );
        })}
    </YStack>
  );
}

interface INormalManageContentProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  marketAddress?: string;
  reserveAddress?: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  earnAccount?: {
    accountId: string;
  };
  depositDisabled: boolean;
  withdrawDisabled: boolean;
  stakeBeforeFooter: React.ReactElement | null;
  withdrawBeforeFooter: React.ReactElement | null;
  footerActionOverride?: IManagePositionFooterAction;
  historyAction?: IEarnHistoryActionIcon;
  onHistory?: (params?: { filterType?: string }) => void;
  indicatorAccountId?: string;
  stakeTag?: IStakeTag;
  onIndicatorRefresh?: () => void;
  onRefreshPendingRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onSuccess?: (info?: IWithdrawSuccessInfo) => void;
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;
  isInModalContext: boolean;
  appNavigation: IAppNavigation;
  showApyDetail?: boolean;
  fallbackTokenImageUri?: string;
  stakeProtocolSwitchConfig?: IManagePositionProtocolSwitchConfig;
  suppressPlatformBonus?: boolean;
  ongoingValidator?: IEarnSelectField;
  managePageData?: IEarnManagePageResponse;
  type?: EManagePositionType;
  preferManagePageActionText?: boolean;
  // The Earn Router page deposits only; withdrawing has an entry of its own
  depositOnly?: boolean;
  // A position's Withdraw, the other way round
  withdrawOnly?: boolean;
  // The Earn lending details page's form: Withdraw keeps to its asset
  isEarnLending?: boolean;
  payWith?: IManagePositionPayWith;
  initialAmount?: string;
  // The caller's own protocol selector, drawn where the form's switcher goes
  // (on the withdraw side, the position's protocol as a row)
  offerSwitch?: ReactNode;
  onAmountChange?: (amount: string) => void;
  // A modal showing one side takes the History and quote controls for its
  // own header, as the tab line they sit on isn't there
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
  // The caller draws the tab line (the Borrow reserve page's own switch):
  // none here, and the controls go up through onHeaderRightChange
  hidesTabLine?: boolean;
}

export function NormalManageContent({
  networkId,
  symbol,
  provider,
  vault: _vault,
  marketAddress,
  reserveAddress,
  tokenInfo,
  protocolInfo,
  earnAccount,
  depositDisabled,
  withdrawDisabled,
  stakeBeforeFooter,
  withdrawBeforeFooter,
  footerActionOverride,
  historyAction,
  onHistory,
  indicatorAccountId,
  stakeTag,
  onIndicatorRefresh,
  onRefreshPendingRef,
  onSuccess,
  defaultTab,
  onTabChange,
  isInModalContext,
  appNavigation,
  showApyDetail,
  fallbackTokenImageUri,
  stakeProtocolSwitchConfig,
  suppressPlatformBonus,
  ongoingValidator,
  managePageData,
  type = EManagePositionType.Staking,
  preferManagePageActionText = false,
  depositOnly,
  withdrawOnly,
  isEarnLending,
  payWith,
  initialAmount,
  offerSwitch,
  onAmountChange,
  onHeaderRightChange,
  hidesTabLine,
}: INormalManageContentProps) {
  const intl = useIntl();
  const useBorrowApi = useMemo(
    () => type !== EManagePositionType.Staking,
    [type],
  );
  const borrowActionPrimary = useMemo<IBorrowAction | undefined>(() => {
    if (!useBorrowApi) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return 'supply';
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return 'borrow';
    }
    return undefined;
  }, [type, useBorrowApi]);

  const borrowActionSecondary = useMemo<IBorrowAction | undefined>(() => {
    if (!useBorrowApi) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return 'withdraw';
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return 'repay';
    }
    return undefined;
  }, [type, useBorrowApi]);

  const borrowActionLabelPrimary = useMemo<string | undefined>(() => {
    if (!useBorrowApi || !managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.supply?.text?.text;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.borrow?.text?.text;
    }
    return undefined;
  }, [type, useBorrowApi, managePageData]);

  const borrowActionLabelSecondary = useMemo<string | undefined>(() => {
    if (!useBorrowApi || !managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.withdraw?.text?.text;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.repay?.text?.text;
    }
    return undefined;
  }, [type, useBorrowApi, managePageData]);

  const resolveManageActionTitle = useCallback(
    ({
      actionData,
      fallbackId,
      fallbackType,
    }: {
      actionData?: IManageActionData;
      fallbackId: ETranslations;
      fallbackType?: string;
    }) => {
      if (actionData?.text?.text) {
        return actionData.text.text;
      }

      const normalizedActionType = (actionData?.type || fallbackType || '')
        .trim()
        .toLowerCase();

      switch (normalizedActionType) {
        case EManagePageActionType.Buy:
          return intl.formatMessage({ id: ETranslations.global_buy });
        case EManagePageActionType.SellEarly:
          return intl.formatMessage({ id: ETranslations.defi_sell_early });
        case EManagePageActionType.Redeem:
          return intl.formatMessage({ id: ETranslations.global_redeem });
        case EManagePageActionType.Sell:
          return intl.formatMessage({ id: ETranslations.global_sell });
        case EStakingActionType.Withdraw:
          return intl.formatMessage({ id: ETranslations.global_withdraw });
        case EStakingActionType.Borrow:
          return intl.formatMessage({ id: ETranslations.global_borrow });
        case EStakingActionType.Repay:
          return intl.formatMessage({ id: ETranslations.defi_repay });
        case EStakingActionType.Supply:
          return intl.formatMessage({ id: ETranslations.defi_supply });
        default:
          return intl.formatMessage({ id: fallbackId });
      }
    },
    [intl],
  );

  const isSwapManagePage = useMemo(
    () => !!(managePageData?.buy || managePageData?.sell),
    [managePageData?.buy, managePageData?.sell],
  );

  const stakeActionData = useMemo<IManageActionData>(() => {
    if (!managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.supply ?? managePageData.deposit;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.borrow ?? managePageData.deposit;
    }
    if (preferManagePageActionText && isSwapManagePage) {
      return managePageData.buy?.payButton ?? managePageData.deposit;
    }
    return managePageData.deposit ?? managePageData.buy?.payButton;
  }, [isSwapManagePage, managePageData, preferManagePageActionText, type]);

  const withdrawActionData = useMemo<IManageActionData>(() => {
    if (!managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.withdraw;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.repay ?? managePageData.withdraw;
    }
    if (preferManagePageActionText && isSwapManagePage) {
      return managePageData.sell?.payButton ?? managePageData.withdraw;
    }
    return managePageData.withdraw ?? managePageData.sell?.payButton;
  }, [isSwapManagePage, managePageData, preferManagePageActionText, type]);

  const stakeReceiveActionData = useMemo<IManageActionData>(
    () =>
      preferManagePageActionText && isSwapManagePage
        ? managePageData?.buy?.receiveButton
        : (managePageData?.buy?.receiveButton ?? withdrawActionData),
    [
      isSwapManagePage,
      managePageData?.buy?.receiveButton,
      preferManagePageActionText,
      withdrawActionData,
    ],
  );

  const withdrawReceiveActionData = useMemo<IManageActionData>(
    () =>
      preferManagePageActionText && isSwapManagePage
        ? managePageData?.sell?.receiveButton
        : (managePageData?.sell?.receiveButton ?? stakeActionData),
    [
      isSwapManagePage,
      managePageData?.sell?.receiveButton,
      preferManagePageActionText,
      stakeActionData,
    ],
  );

  const buildTokenInfoFromActionData = useCallback(
    (actionData?: IManageActionData): IEarnTokenInfo | undefined => {
      if (!actionData?.data?.token) {
        return undefined;
      }

      return {
        networkId,
        provider,
        vault: _vault,
        accountId: tokenInfo?.accountId ?? earnAccount?.accountId ?? '',
        indexedAccountId: tokenInfo?.indexedAccountId,
        nativeToken: tokenInfo?.nativeToken,
        balanceParsed:
          actionData.data.balance ?? tokenInfo?.balanceParsed ?? '0',
        token: actionData.data.token.info,
        price: actionData.data.token.price,
      };
    },
    [
      networkId,
      provider,
      _vault,
      tokenInfo?.accountId,
      tokenInfo?.indexedAccountId,
      tokenInfo?.nativeToken,
      tokenInfo?.balanceParsed,
      earnAccount?.accountId,
    ],
  );

  const stakeTokenInfo = useMemo(
    () => buildTokenInfoFromActionData(stakeActionData) ?? tokenInfo,
    [buildTokenInfoFromActionData, stakeActionData, tokenInfo],
  );

  const withdrawTokenInfo = useMemo(
    () => buildTokenInfoFromActionData(withdrawActionData) ?? tokenInfo,
    [buildTokenInfoFromActionData, withdrawActionData, tokenInfo],
  );

  const stakeReceiveInputConfig = useMemo(
    () =>
      preferManagePageActionText
        ? {
            enabled: !!stakeReceiveActionData?.data?.token,
            tokenImageUri: stakeReceiveActionData?.data?.token?.info?.logoURI,
            tokenSymbol: stakeReceiveActionData?.data?.token?.info?.symbol,
            tokenAddress: stakeReceiveActionData?.data?.token?.info?.address,
            balance: stakeReceiveActionData?.data?.balance,
            price: stakeReceiveActionData?.data?.token?.price,
          }
        : undefined,
    [preferManagePageActionText, stakeReceiveActionData],
  );

  const withdrawReceiveInputConfig = useMemo(
    () =>
      preferManagePageActionText
        ? {
            enabled: !!withdrawReceiveActionData?.data?.token,
            tokenImageUri:
              withdrawReceiveActionData?.data?.token?.info?.logoURI,
            tokenSymbol: withdrawReceiveActionData?.data?.token?.info?.symbol,
            tokenAddress: withdrawReceiveActionData?.data?.token?.info?.address,
            balance: withdrawReceiveActionData?.data?.balance,
            price: withdrawReceiveActionData?.data?.token?.price,
          }
        : undefined,
    [preferManagePageActionText, withdrawReceiveActionData],
  );

  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    if (defaultTab === 'withdraw' || withdrawOnly) return 1;
    return 0;
  });
  const [
    repayWithCollateralSetupReadyProgressKey,
    setRepayWithCollateralSetupReadyProgressKey,
  ] = useState('');
  const shouldDisablePrimaryTab = depositDisabled;

  // Pendle: slippage state + countdown
  const isPendleProvider = useIsPendleProvider(provider);

  const [pendleSlippage, setPendleSlippage] =
    useState<ISwapSlippageSegmentItem>({
      key: ESwapSlippageSegmentKey.AUTO,
      value: swapSlippageAutoValue,
    });

  const pendleSlippageValue = useMemo(
    () => (isPendleProvider ? pendleSlippage.value : undefined),
    [isPendleProvider, pendleSlippage.value],
  );

  const stakeCountdown = useQuoteCountdown({
    enabled: isPendleProvider && selectedTabIndex === 0,
  });

  const withdrawCountdown = useQuoteCountdown({
    enabled: isPendleProvider && selectedTabIndex === 1,
  });

  // refreshKey: incremented by header refresh button to signal child components to re-quote
  const [stakeRefreshKey, setStakeRefreshKey] = useState(0);
  const [withdrawRefreshKey, setWithdrawRefreshKey] = useState(0);
  const [stakeQuoteRefreshing, setStakeQuoteRefreshing] = useState(false);
  const [withdrawQuoteRefreshing, setWithdrawQuoteRefreshing] = useState(false);
  const activeQuoteRefreshing =
    selectedTabIndex === 0 ? stakeQuoteRefreshing : withdrawQuoteRefreshing;

  // Cooldown trigger: increments when a quote is successfully fetched, drives 5s header refresh cooldown
  const [refreshCooldownTrigger, setRefreshCooldownTrigger] = useState(0);

  const handleStakeQuoteReset = useCallback(() => {
    stakeCountdown.reset();
    setRefreshCooldownTrigger((prev) => prev + 1);
  }, [stakeCountdown]);

  const handleWithdrawQuoteReset = useCallback(() => {
    withdrawCountdown.reset();
    setRefreshCooldownTrigger((prev) => prev + 1);
  }, [withdrawCountdown]);

  const handleHeaderRefreshQuote = useCallback(() => {
    // Don't reset countdown here — let onQuoteReset do it after successful fetch
    if (selectedTabIndex === 0) {
      setStakeRefreshKey((prev) => prev + 1);
    } else {
      setWithdrawRefreshKey((prev) => prev + 1);
    }
  }, [selectedTabIndex]);

  const handleStakeQuoteRefreshingChange = useCallback((loading: boolean) => {
    setStakeQuoteRefreshing(loading);
  }, []);

  const handleWithdrawQuoteRefreshingChange = useCallback(
    (loading: boolean) => {
      setWithdrawQuoteRefreshing(loading);
    },
    [],
  );

  const handleOpenSlippage = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.slippage_tolerance_title,
      }),
      renderContent: (
        <SlippageSettingDialog
          swapSlippage={pendleSlippage}
          autoValue={swapSlippageAutoValue}
          onSave={(item, close) => {
            setPendleSlippage(item);
            handleHeaderRefreshQuote();
            void close({ flag: 'save' });
          }}
          isMEV={false}
        />
      ),
    });
  }, [intl, pendleSlippage, handleHeaderRefreshQuote]);

  useEffect(() => {
    if (defaultTab === 'withdraw') {
      setSelectedTabIndex(1);
    } else if (defaultTab === 'deposit') {
      setSelectedTabIndex(0);
    }
  }, [defaultTab]);

  const tabData = useMemo(() => {
    if (managePageData) {
      if (
        [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(
          type,
        )
      ) {
        return [
          {
            title: resolveManageActionTitle({
              actionData: managePageData.supply,
              fallbackId: ETranslations.defi_supply,
              fallbackType: 'supply',
            }),
            type: EStakingActionType.Supply,
          },
          {
            title: resolveManageActionTitle({
              actionData: managePageData.withdraw,
              fallbackId: ETranslations.global_withdraw,
              fallbackType: 'withdraw',
            }),
            type: EStakingActionType.Withdraw,
          },
        ];
      }
      if (
        [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
      ) {
        return [
          {
            title: resolveManageActionTitle({
              actionData: managePageData.borrow,
              fallbackId: ETranslations.global_borrow,
              fallbackType: 'borrow',
            }),
            type: EStakingActionType.Borrow,
          },
          {
            title: resolveManageActionTitle({
              actionData: managePageData.repay,
              fallbackId: ETranslations.defi_repay,
              fallbackType: 'repay',
            }),
            type: EStakingActionType.Repay,
          },
        ];
      }

      if (preferManagePageActionText) {
        return [
          {
            title: resolveManageActionTitle({
              actionData: stakeActionData,
              fallbackId: ETranslations.earn_deposit,
              fallbackType: 'deposit',
            }),
            type: EStakingActionType.Deposit,
          },
          {
            title: resolveManageActionTitle({
              actionData: withdrawActionData,
              fallbackId: ETranslations.global_withdraw,
              fallbackType: 'withdraw',
            }),
            type: EStakingActionType.Withdraw,
          },
        ];
      }
    }

    // Before the server's own names (or with no wallet to ask for them): a
    // lending market's sides keep their names, Supply and Withdraw, or
    // Borrow and Repay, as they read once a wallet is connected
    const isSupplySide = [
      EManagePositionType.Supply,
      EManagePositionType.Withdraw,
    ].includes(type);
    const isBorrowSide = [
      EManagePositionType.Borrow,
      EManagePositionType.Repay,
    ].includes(type);
    let primaryId = ETranslations.earn_deposit;
    if (isSupplySide) {
      primaryId = ETranslations.defi_supply;
    } else if (isBorrowSide) {
      primaryId = ETranslations.global_borrow;
    }
    return [
      {
        title: intl.formatMessage({ id: primaryId }),
        type: EStakingActionType.Deposit,
      },
      {
        title: intl.formatMessage({
          id: isBorrowSide
            ? ETranslations.defi_repay
            : ETranslations.global_withdraw,
        }),
        type: EStakingActionType.Withdraw,
      },
    ];
  }, [
    intl,
    managePageData,
    type,
    preferManagePageActionText,
    resolveManageActionTitle,
    stakeActionData,
    withdrawActionData,
  ]);

  const tabNames = useMemo(() => tabData.map((item) => item.title), [tabData]);
  const visibleTabNames = useMemo(() => {
    if (depositOnly) return tabNames.slice(0, 1);
    if (withdrawOnly) return tabNames.slice(1, 2);
    return tabNames;
  }, [depositOnly, withdrawOnly, tabNames]);

  // The Withdraw side's rows and ways out, read while Deposit is on screen:
  // it fades in with them in place rather than settling after it shows
  const withdrawSymbol = protocolInfo?.symbol || tokenInfo?.token?.symbol;
  const withdrawTokenAddress = tokenInfo?.token?.isNative
    ? ''
    : tokenInfo?.token?.address;
  const canWarmWithdraw =
    !isInModalContext &&
    visibleTabNames.length > 1 &&
    !withdrawDisabled &&
    !useBorrowApi;
  useEffect(() => {
    if (!canWarmWithdraw || !earnAccount?.accountId || !withdrawSymbol) {
      return;
    }
    void warmWithdrawWaysOut({
      accountId: earnAccount.accountId,
      networkId,
      providerName: provider,
      symbol: withdrawSymbol,
      vault: protocolInfo?.vault,
      inputTokenAddress: withdrawTokenAddress,
    });
  }, [
    canWarmWithdraw,
    earnAccount?.accountId,
    networkId,
    protocolInfo?.vault,
    provider,
    withdrawSymbol,
    withdrawTokenAddress,
  ]);

  useEffect(() => {
    if (depositOnly) {
      return;
    }
    if (depositDisabled && selectedTabIndex === 0) {
      setSelectedTabIndex(1);
      onTabChange?.('withdraw');
    }
  }, [depositOnly, depositDisabled, selectedTabIndex, onTabChange]);

  const isWithdrawOrder = useMemo(() => {
    return (
      protocolInfo?.withdrawAction?.type === EStakingActionType.WithdrawOrder
    );
  }, [protocolInfo?.withdrawAction?.type]);

  // A provider that redeems per order (Stakefish SOL/ETH, Everstake SOL,
  // Babylon) has no amount for the withdraw tab to take: Redeem is picking
  // the order, on WithdrawOptions.
  const openWithdrawOptions = useCallback(() => {
    const withdrawParams = {
      accountId: earnAccount?.accountId || '',
      networkId,
      protocolInfo,
      tokenInfo: withdrawTokenInfo,
      symbol,
      provider,
      onSuccess,
      isInModalContext,
    };

    if (isInModalContext) {
      appNavigation.push(EModalStakingRoutes.WithdrawOptions, withdrawParams);
    } else {
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.WithdrawOptions,
        params: withdrawParams,
      });
    }
  }, [
    earnAccount?.accountId,
    networkId,
    protocolInfo,
    withdrawTokenInfo,
    symbol,
    provider,
    onSuccess,
    isInModalContext,
    appNavigation,
  ]);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        if (index === 0 && shouldDisablePrimaryTab) {
          return;
        }
        if (index === 1 && isWithdrawOrder) {
          openWithdrawOptions();
          return;
        }

        setSelectedTabIndex(index);

        const newTab = index === 0 ? 'deposit' : 'withdraw';
        onTabChange?.(newTab);
      }
    },
    [
      isWithdrawOrder,
      shouldDisablePrimaryTab,
      tabData,
      onTabChange,
      openWithdrawOptions,
    ],
  );

  // Opened straight on the withdraw tab (the positions card's Redeem, the
  // protocol list's) for such a provider: the tab would show an input with
  // nothing to take (OK-64779's SOL). Once the manage read says the
  // withdrawal is by order and the earn account is known, go to the order
  // picker the way switching to the tab does, once, and leave the page on
  // Deposit behind it unless Deposit is closed.
  const withdrawOrderHandoffRef = useRef(false);
  useEffect(() => {
    if (
      defaultTab !== 'withdraw' ||
      !isWithdrawOrder ||
      !earnAccount?.accountId ||
      withdrawOrderHandoffRef.current
    ) {
      return;
    }
    withdrawOrderHandoffRef.current = true;
    // With the withdraw side alone there is no Deposit to leave behind it
    if (!depositDisabled && !withdrawOnly) {
      setSelectedTabIndex(0);
      onTabChange?.('deposit');
    }
    openWithdrawOptions();
  }, [
    defaultTab,
    isWithdrawOrder,
    earnAccount?.accountId,
    depositDisabled,
    withdrawOnly,
    onTabChange,
    openWithdrawOptions,
  ]);

  // A modal showing one side draws the controls in its header, so the line
  // they share with the tabs goes; so does a caller with a line of its own
  const liftsHeaderControls =
    Boolean(onHeaderRightChange) &&
    (Boolean(hidesTabLine) ||
      (isInModalContext && visibleTabNames.length === 1));
  const headerRight = (
    <HeaderRight
      accountId={indicatorAccountId || earnAccount?.accountId}
      networkId={networkId}
      stakeTag={stakeTag || protocolInfo?.stakeTag}
      historyAction={historyAction}
      onHistory={onHistory}
      onRefresh={isInModalContext ? undefined : onIndicatorRefresh}
      onRefreshPending={(refreshFn) => {
        if (onRefreshPendingRef) {
          onRefreshPendingRef.current = refreshFn;
        }
      }}
      isPendleProvider={isPendleProvider}
      onRefreshQuote={handleHeaderRefreshQuote}
      refreshLoading={activeQuoteRefreshing}
      refreshCooldownTrigger={refreshCooldownTrigger}
      onOpenSlippage={handleOpenSlippage}
      onLift={liftsHeaderControls ? onHeaderRightChange : undefined}
    />
  );

  const stakeSection = withdrawOnly ? null : (
    <StakeSection
      accountId={earnAccount?.accountId || ''}
      networkId={networkId}
      tokenInfo={stakeTokenInfo}
      protocolInfo={protocolInfo}
      isDisabled={depositDisabled}
      onSuccess={onSuccess}
      beforeFooter={stakeBeforeFooter}
      footerActionOverride={footerActionOverride}
      confirmWordIdWhileLoading={readConfirmWordId({
        networkId,
        providerName: provider,
        symbol,
        vault: _vault,
      })}
      showApyDetail={showApyDetail}
      suppressPlatformBonus={suppressPlatformBonus}
      isInModalContext={isInModalContext}
      fallbackTokenImageUri={fallbackTokenImageUri}
      protocolSwitchConfig={stakeProtocolSwitchConfig}
      payWith={payWith}
      initialAmount={initialAmount}
      offerSwitch={offerSwitch}
      onAmountChange={onAmountChange}
      ongoingValidator={ongoingValidator}
      useBorrowApi={useBorrowApi}
      borrowMarketAddress={marketAddress}
      borrowReserveAddress={reserveAddress}
      borrowAction={borrowActionPrimary}
      borrowActionLabel={borrowActionLabelPrimary}
      receiveInputConfig={stakeReceiveInputConfig}
      pendleSlippage={pendleSlippageValue}
      isQuoteExpired={stakeCountdown.isExpired}
      onQuoteReset={handleStakeQuoteReset}
      refreshKey={stakeRefreshKey}
      onQuoteRefreshingChange={handleStakeQuoteRefreshingChange}
      onRefreshTokenInfo={onIndicatorRefresh}
    />
  );

  const withdrawSection = depositOnly ? null : (
    <WithdrawSection
      accountId={earnAccount?.accountId || ''}
      networkId={networkId}
      tokenInfo={withdrawTokenInfo}
      protocolInfo={protocolInfo}
      isDisabled={withdrawDisabled}
      onSuccess={onSuccess}
      beforeFooter={withdrawBeforeFooter}
      footerActionOverride={footerActionOverride}
      showApyDetail={showApyDetail}
      isInModalContext={isInModalContext}
      fallbackTokenImageUri={fallbackTokenImageUri}
      useBorrowApi={useBorrowApi}
      borrowMarketAddress={marketAddress}
      borrowReserveAddress={reserveAddress}
      borrowAction={borrowActionSecondary}
      defaultCollateralReserveAddress={
        managePageData?.collateral?.data?.reserveAddress
      }
      borrowActionLabel={borrowActionLabelSecondary}
      receiveInputConfig={withdrawReceiveInputConfig}
      pendleSlippage={pendleSlippageValue}
      isQuoteExpired={withdrawCountdown.isExpired}
      onQuoteReset={handleWithdrawQuoteReset}
      refreshKey={withdrawRefreshKey}
      onQuoteRefreshingChange={handleWithdrawQuoteRefreshingChange}
      repayWithCollateralSetupReadyProgressKey={
        repayWithCollateralSetupReadyProgressKey
      }
      onRepayWithCollateralSetupReadyProgressKeyChange={
        setRepayWithCollateralSetupReadyProgressKey
      }
      offerSwitch={offerSwitch}
      isEarnLending={isEarnLending}
      actionLabel={tabNames[1]}
    />
  );

  return (
    <>
      {liftsHeaderControls ? (
        headerRight
      ) : (
        <XStack jc="space-between" px="$5">
          {visibleTabNames.length === 1 ? (
            // One side alone (the router, or a modal opened for one action)
            // gets a title on the tab's line, in line with the amount box's
            // label, instead of a tab with nothing beside it to switch to
            <SizableText
              size="$headingMd"
              letterSpacing={-0.15}
              py="$1.5"
              px="$3.5"
              color={
                shouldDisablePrimaryTab && visibleTabNames[0] === tabNames[0]
                  ? '$textDisabled'
                  : '$text'
              }
            >
              {visibleTabNames[0]}
            </SizableText>
          ) : (
            <SegmentControl
              value={tabNames[selectedTabIndex] ?? visibleTabNames[0]}
              onChange={(value) => handleTabChange(String(value))}
              options={visibleTabNames.map((name, index) => {
                const isDisabled =
                  shouldDisablePrimaryTab && name === tabNames[0];
                let textColor: '$textDisabled' | '$text' | '$textSubdued' =
                  '$textSubdued';
                if (isDisabled) {
                  textColor = '$textDisabled';
                } else if (name === tabNames[selectedTabIndex]) {
                  textColor = '$text';
                }
                return {
                  value: name,
                  disabled: isDisabled,
                  testID:
                    index === 0
                      ? 'earn-manage-tab-deposit'
                      : 'earn-manage-tab-withdraw',
                  label: (
                    <SizableText
                      size="$headingMd"
                      color={textColor}
                      letterSpacing={-0.15}
                      numberOfLines={1}
                    >
                      {name}
                    </SizableText>
                  ),
                };
              })}
              slotBackgroundColor="$transparent"
              activeBackgroundColor="$bgActive"
              h="auto"
              p={0}
              gap="$1"
              borderRadius="$2"
              overflow="visible"
              segmentControlItemStyleProps={TAB_ITEM_STYLE}
            />
          )}
          {headerRight}
        </XStack>
      )}
      <TabContentFade
        selectedIndex={selectedTabIndex}
        enabled={!isInModalContext && visibleTabNames.length > 1}
        sides={[stakeSection, withdrawSection]}
      />
    </>
  );
}
