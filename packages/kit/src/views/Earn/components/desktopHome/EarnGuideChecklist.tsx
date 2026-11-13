import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  AnimatePresence,
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import type { ITooltipRef } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { useFiatCrypto } from '../../../FiatCrypto/hooks';
import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { DottedUnderlineText } from '../../../Staking/components/ProtocolDetails/DottedUnderline';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { EarnNavigation } from '../../earnUtils';
import { buildEarnSwapToken } from '../../pages/EarnRouter/earnRouter.utils';
import { useEarnRouterOffers } from '../../pages/EarnRouter/EarnRouterOffer';
import { usePayTokens } from '../../pages/EarnRouter/EarnRouterPayWith';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import {
  EARN_GUIDE_STEPS,
  EARN_GUIDE_SUGGESTED_GAS,
  EARN_GUIDE_SYMBOL,
  getEarnGuideNetworkId,
  isGuideVaultOffer,
  pickGuideSwapFrom,
} from './earnGuide.utils';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnGuideState, IEarnGuideStep } from './earnGuide.utils';
import type { IEarnGuide } from './earnGuideStore';

const copy = EARN_DESKTOP_DEMO_COPY;
const PANEL_WIDTH = 320;
// A task's actions and its explanation start under its name, past the mark
const MARK_SIZE = 20;
const MARK_GAP = 10;
const GAS_POLL_MS = 8000;
// The app's floating surface, as its popovers have it
const FLOATING_SURFACE = {
  bg: '$bg',
  outlineColor: '$neutral3',
  outlineStyle: 'solid',
  outlineWidth: '$px',
  boxShadow:
    '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
} as const;
const HIDDEN_STYLE = { opacity: 0 } as const;
const RISE_STYLE = { opacity: 0, y: 6 } as const;
const INFO_CONTENT_PROPS = {
  p: '$4',
  borderRadius: '$3',
  maxWidth: 280,
} as const;

type IGuideTaskStatus = 'done' | 'current' | 'upcoming';

const getTaskStatus = (
  state: IEarnGuideState,
  step: IEarnGuideStep,
): IGuideTaskStatus => {
  if (state.done[step - 1]) {
    return 'done';
  }
  return step === state.current ? 'current' : 'upcoming';
};

function TaskMarkFace({
  step,
  status,
}: {
  step: IEarnGuideStep;
  status: IGuideTaskStatus;
}) {
  if (status === 'done') {
    return <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />;
  }
  const isCurrent = status === 'current';
  return (
    <YStack
      w={MARK_SIZE}
      h={MARK_SIZE}
      borderRadius="$full"
      bg={isCurrent ? '$bgPrimary' : undefined}
      borderWidth={isCurrent ? 0 : 1.5}
      borderColor="$neutral6"
      ai="center"
      jc="center"
    >
      <SizableText
        size="$bodySmMedium"
        // The primary button's pair: the number reads on the mark in both themes
        color={isCurrent ? '$textInverse' : '$textSubdued'}
      >
        {step}
      </SizableText>
    </YStack>
  );
}

/**
 * A task's number in a circle; a done task's check takes its place. As the
 * guide moves on, the new mark fades in over the old one as it fades out
 */
function TaskMark({
  step,
  status,
}: {
  step: IEarnGuideStep;
  status: IGuideTaskStatus;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <TaskMarkFace step={step} status={status} />;
  }
  return (
    <YStack w={MARK_SIZE} h={MARK_SIZE}>
      <AnimatePresence initial={false}>
        <YStack
          key={status}
          position="absolute"
          t={0}
          l={0}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={HIDDEN_STYLE}
          exitStyle={HIDDEN_STYLE}
        >
          <TaskMarkFace step={step} status={status} />
        </YStack>
      </AnimatePresence>
    </YStack>
  );
}

/**
 * A task's name. The current one explains itself the app's way: a dotted
 * rule under it, and the why in a small window while the pointer (or the
 * keyboard's focus) is on it, so the list keeps to its few words
 */
function TaskLabel({
  testID,
  label,
  info,
  status,
}: {
  testID: string;
  label: string;
  info?: string;
  status: IGuideTaskStatus;
}) {
  const tooltipRef = useRef<ITooltipRef>({
    closeTooltip: () => Promise.resolve(),
    openTooltip: () => Promise.resolve(),
  });
  const handleFocus = useCallback(() => {
    void tooltipRef.current.openTooltip();
  }, []);
  const handleBlur = useCallback(() => {
    void tooltipRef.current.closeTooltip();
  }, []);
  const isCurrent = status === 'current';
  const textProps = {
    size: isCurrent ? '$bodyLgMedium' : '$bodyLg',
    color: isCurrent ? '$text' : '$textSubdued',
    numberOfLines: 1,
  } as const;
  if (!isCurrent || !info) {
    return (
      <SizableText testID={testID} flexShrink={1} {...textProps}>
        {label}
      </SizableText>
    );
  }
  return (
    <Tooltip
      ref={tooltipRef}
      hovering
      placement="top-start"
      contentProps={INFO_CONTENT_PROPS}
      renderContent={<SizableText size="$bodyMd">{info}</SizableText>}
      renderTrigger={
        <Stack
          testID={testID}
          flexShrink={1}
          borderRadius="$1"
          {...(platformEnv.isRuntimeBrowser
            ? {
                tabIndex: 0,
                onFocus: handleFocus,
                onBlur: handleBlur,
                focusVisibleStyle: {
                  outlineColor: '$focusRing',
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineOffset: 2,
                },
              }
            : undefined)}
        >
          <DottedUnderlineText {...textProps}>{label}</DottedUnderlineText>
        </Stack>
      }
    />
  );
}

type IGuideTaskAction = {
  testID: string;
  label: string;
  onPress: () => void;
};

function TaskRow({
  step,
  status,
  label,
  info,
  actions,
}: {
  step: IEarnGuideStep;
  status: IGuideTaskStatus;
  label: string;
  info?: string;
  /** The ways to do the task, the first the one this wallet can use now */
  actions: IGuideTaskAction[];
}) {
  return (
    <YStack
      testID={`earn-guide-task-${step}`}
      aria-current={status === 'current' ? 'step' : undefined}
      gap="$2.5"
    >
      <XStack ai="center" gap={MARK_GAP}>
        <TaskMark step={step} status={status} />
        <TaskLabel
          testID={`earn-guide-task-${step}-label`}
          label={label}
          info={info}
          status={status}
        />
      </XStack>
      {status === 'current' && actions.length > 0 ? (
        <XStack pl={MARK_SIZE + MARK_GAP} gap="$2" flexWrap="wrap">
          {actions.map((action, index) => (
            <Button
              key={action.testID}
              testID={action.testID}
              size="small"
              variant={index === 0 ? 'primary' : 'secondary'}
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}

// How far the guide is, as a ring: the pill's whole picture of the list
function ProgressRing({ done, total }: { done: number; total: number }) {
  const theme = useTheme();
  const size = 18;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={theme.neutral5.val}
        strokeWidth={stroke}
        fill="none"
      />
      {done > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.iconSuccess.val}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(length * done) / total} ${length}`}
          fill="none"
          // From the top, clockwise
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}

// While task 1 waits the checklist checks the account itself, so the ETH
// shows up here without the home's slower full refresh
function useGuideGasPoll({
  scope,
  account,
  networkId,
  enabled,
}: {
  scope: string;
  account?: INetworkAccount;
  networkId: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!account || !enabled) {
      return undefined;
    }
    let isStopped = false;
    const check = async () => {
      try {
        const info =
          await backgroundApiProxy.serviceAccountProfile.fetchAccountNativeBalance(
            { account, networkId },
          );
        if (!isStopped) {
          earnGuideStore.setPolledGas({
            scope,
            amount: new BigNumber(info.balanceParsed ?? 0).toNumber() || 0,
          });
        }
      } catch {
        // The next check tries again
      }
    };
    void check();
    const timer = setInterval(() => void check(), GAS_POLL_MS);
    return () => {
      isStopped = true;
      clearInterval(timer);
    };
  }, [account, enabled, networkId, scope]);
}

function EarnGuideChecklistView({ guide }: { guide: IEarnGuide }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const media = useMedia();
  const reduceMotion = useReducedMotion();
  const { scope, state, isPreview, live } = guide;
  const hasWallet = Boolean(live?.hasWallet);
  const networkId = getEarnGuideNetworkId();
  const { earnAccount } = useEarnAccount({ networkId });
  const accountId = earnAccount?.accountId ?? '';
  const walletId = earnAccount?.walletId ?? '';
  const { current } = state;
  const hasGas = state.done[0];
  const isWaitingForGas = hasWallet && !hasGas && !isPreview;

  useGuideGasPoll({
    scope,
    account: earnAccount?.account,
    networkId,
    enabled: isWaitingForGas,
  });

  // Task 1's ways to the ETH: Swap for a wallet that holds something on
  // another network (it opens on a bridge from there to ETH on Base), Buy
  // with money, Receive from an exchange or another wallet
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
  const { handleFiatCrypto, isSupported: canBuy } = useFiatCrypto({
    accountId,
    networkId,
    fiatCryptoType: 'buy',
  });
  const pay = usePayTokens({
    accountId,
    networkId,
    depositSymbol: 'ETH',
    enabled: isWaitingForGas,
    acrossNetworks: true,
  });
  const swapFrom = useMemo(
    () => pickGuideSwapFrom(pay.heldTokens, networkId),
    [networkId, pay.heldTokens],
  );
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );
  const networkLogoURI = network?.logoURI;
  const handleSwap = useCallback(async () => {
    if (!swapFrom) {
      return;
    }
    const [toToken, fromNetwork] = await Promise.all([
      backgroundApiProxy.serviceToken.getNativeToken({ networkId, accountId }),
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: swapFrom.networkId,
      }),
    ]);
    if (!toToken) {
      return;
    }
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importFromToken: {
          ...buildEarnSwapToken({
            networkId: swapFrom.networkId,
            token: swapFrom.token,
            priceUsd: swapFrom.priceUsd,
          }),
          networkLogoURI: fromNetwork?.logoURI,
        },
        importToToken: {
          ...buildEarnSwapToken({ networkId, token: toToken }),
          networkLogoURI,
        },
        swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
        swapSource: ESwapSource.EARN,
      },
    });
  }, [accountId, navigation, networkId, networkLogoURI, swapFrom]);
  const handleBuy = useCallback(() => {
    if (canBuy) {
      handleFiatCrypto(undefined);
    }
  }, [canBuy, handleFiatCrypto]);
  const handleReceive = useCallback(async () => {
    if (!accountId || !walletId) {
      return;
    }
    const token = await backgroundApiProxy.serviceToken.getNativeToken({
      networkId,
      accountId,
    });
    if (!token) {
      return;
    }
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: { networkId, accountId, walletId, token },
    });
  }, [accountId, navigation, networkId, walletId]);

  // Task 2 opens the Earn window on USDC on Base, starting on the PO's
  // example vault once the offers are in (the best rate there otherwise)
  const { offers } = useEarnRouterOffers({
    symbol: EARN_GUIDE_SYMBOL,
    networkId,
    enabled: current === 2,
  });
  const offerKey = useMemo(() => offers.find(isGuideVaultOffer)?.key, [offers]);
  const handleDeposit = useCallback(() => {
    EarnNavigation.pushToEarnOffersDeposit(navigation, {
      symbol: EARN_GUIDE_SYMBOL,
      networkId,
      offerKey,
      wide: true,
    });
  }, [navigation, networkId, offerKey]);

  // Task 3 is done by going there; the guide ends with it
  const handleOpenPortfolio = useCallback(() => {
    if (isPreview) {
      earnGuideStore.setPreview(undefined);
    } else {
      earnGuideStore.save(scope, { completed: true });
    }
    EarnNavigation.pushToEarnPositions(navigation);
  }, [isPreview, navigation, scope]);

  const taskActions = useMemo<
    Record<IEarnGuideStep, IGuideTaskAction[]>
  >(() => {
    const text = (id: ETranslations) => intl.formatMessage({ id });
    let gasActions: IGuideTaskAction[];
    if (!hasWallet && !isPreview) {
      // Without a wallet the first thing to do is connect one
      gasActions = [
        {
          testID: 'earn-guide-connect',
          label: text(ETranslations.global_connect_wallet),
          onPress: () => showAccountSelector(),
        },
      ];
    } else {
      gasActions = [
        ...(swapFrom || isPreview
          ? [
              {
                testID: 'earn-guide-swap',
                label: text(ETranslations.global_swap),
                onPress: () => void handleSwap(),
              },
            ]
          : []),
        ...(canBuy || isPreview
          ? [
              {
                testID: 'earn-guide-buy',
                label: text(ETranslations.global_buy),
                onPress: handleBuy,
              },
            ]
          : []),
        {
          testID: 'earn-guide-receive',
          label: text(ETranslations.global_receive),
          onPress: () => void handleReceive(),
        },
      ];
    }
    return {
      1: gasActions,
      2: [
        {
          testID: 'earn-guide-deposit',
          label: text(ETranslations.earn_deposit),
          onPress: handleDeposit,
        },
      ],
      3: [
        {
          testID: 'earn-guide-portfolio',
          label: copy.guideGoToPortfolio,
          onPress: handleOpenPortfolio,
        },
      ],
    };
  }, [
    canBuy,
    handleBuy,
    handleDeposit,
    handleOpenPortfolio,
    handleReceive,
    handleSwap,
    hasWallet,
    intl,
    isPreview,
    showAccountSelector,
    swapFrom,
  ]);
  const taskInfo: Record<IEarnGuideStep, string | undefined> = {
    1: copy.guideGasInfo(EARN_GUIDE_SUGGESTED_GAS),
    2: copy.guideDepositInfo,
    3: undefined,
  };

  // Open until the user folds it; a phone-wide screen starts on the pill,
  // where the open list would cover the page's width
  const isCollapsed = guide.isCollapsed ?? !media.gtMd;
  const handleCollapse = useCallback(
    () => earnGuideStore.setCollapsed(scope, true),
    [scope],
  );
  const handleExpand = useCallback(
    () => earnGuideStore.setCollapsed(scope, false),
    [scope],
  );
  const doneCount = state.done.filter(Boolean).length;
  const count = `${doneCount}/${EARN_GUIDE_STEPS.length}`;
  const enterProps = reduceMotion
    ? undefined
    : ({
        transition: 'quick',
        animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
        enterStyle: RISE_STYLE,
      } as const);

  let content: ReactNode;
  if (isCollapsed) {
    content = (
      // The surface stays opaque under the hover's tint: the page scrolls
      // behind it
      <XStack
        key="pill"
        borderRadius="$full"
        overflow="hidden"
        {...FLOATING_SURFACE}
        {...enterProps}
      >
        <XStack
          testID="earn-guide-pill"
          role="button"
          aria-label={`${copy.guideTitle} ${count}`}
          aria-expanded={false}
          h="$10"
          pl="$3"
          pr="$4"
          gap="$2"
          ai="center"
          cursor="pointer"
          userSelect="none"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={handleExpand}
          {...buildKeyboardPressProps(handleExpand, -2)}
        >
          <ProgressRing done={doneCount} total={EARN_GUIDE_STEPS.length} />
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {copy.guideTitle}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {count}
          </SizableText>
        </XStack>
      </XStack>
    );
  } else {
    content = (
      <YStack
        key="panel"
        testID="earn-guide-checklist"
        role="group"
        aria-label={copy.guideTitle}
        w={PANEL_WIDTH}
        maxWidth="100%"
        p="$4"
        pt="$3"
        gap="$3"
        borderRadius="$4"
        borderCurve="continuous"
        {...FLOATING_SURFACE}
        {...enterProps}
      >
        <XStack ai="center" jc="space-between" gap="$3">
          <XStack ai="baseline" gap="$2" flexShrink={1} minWidth={0}>
            <SizableText size="$headingMd" numberOfLines={1}>
              {copy.guideTitle}
            </SizableText>
            <SizableText
              testID="earn-guide-count"
              size="$bodyMd"
              color="$textSubdued"
            >
              {count}
            </SizableText>
          </XStack>
          <IconButton
            testID="earn-guide-collapse"
            aria-label={intl.formatMessage({
              id: ETranslations.global_collapse,
            })}
            icon="ChevronDownSmallOutline"
            variant="tertiary"
            size="small"
            // The button's own inset, so its icon ends on the panel's edge
            mr="$-1"
            onPress={handleCollapse}
          />
        </XStack>
        <YStack gap="$3">
          {EARN_GUIDE_STEPS.map((step) => (
            <TaskRow
              key={step}
              step={step}
              status={getTaskStatus(state, step)}
              label={copy.guideSteps[step - 1]}
              info={taskInfo[step]}
              actions={taskActions[step]}
            />
          ))}
        </YStack>
      </YStack>
    );
  }

  return (
    // Over the page's bottom right corner, outside what scrolls. Only the
    // list itself takes the pointer
    <YStack
      position="absolute"
      right="$6"
      bottom="$6"
      zIndex={1}
      ai="flex-end"
      pointerEvents="box-none"
      $md={{ right: '$4', bottom: '$4', left: '$4' }}
    >
      {content}
    </YStack>
  );
}

/**
 * The guide for an account without positions: a list of three tasks floating
 * over the DeFi home's bottom right corner, each opening the app's own
 * window for it (Swap, Buy or Receive for the ETH on Base, the Earn window
 * for the deposit, My portfolio for the position). A task ticks itself when
 * the account shows it done. It folds to a pill with its progress, and goes
 * once the last task is done
 */
export function EarnGuideChecklist() {
  const guide = useEarnGuide();
  if (!guide.isShown) {
    return null;
  }
  return (
    // Buy reads the home's token list and opens in the app's browser
    <HomeTokenListProviderMirror>
      <DiscoveryBrowserProviderMirror>
        <EarnGuideChecklistView guide={guide} />
      </DiscoveryBrowserProviderMirror>
    </HomeTokenListProviderMirror>
  );
}
