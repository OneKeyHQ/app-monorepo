import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  AnimatePresence,
  Button,
  Divider,
  Icon,
  IconButton,
  Progress,
  ScrollView,
  SizableText,
  Toast,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { openFiatCryptoWidget } from '../../../AssetDetails/pages/TokenDetails/ActionBuy';
import { useSupportToken } from '../../../FiatCrypto/hooks';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { EarnNavigation } from '../../earnUtils';
import { buildEarnSwapToken } from '../../pages/EarnRouter/earnRouter.utils';
import { useEarnRouterOffers } from '../../pages/EarnRouter/EarnRouterOffer';
import { usePayTokens } from '../../pages/EarnRouter/EarnRouterPayWith';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import {
  EARN_GUIDE_MIN_DEPOSIT_USD,
  EARN_GUIDE_STEPS,
  EARN_GUIDE_SUGGESTED_GAS,
  EARN_GUIDE_SYMBOL,
  EARN_GUIDE_TOKEN_ADDRESS,
  EARN_GUIDE_TUTORIAL_URL,
  getEarnGuideNetworkId,
  getGuideSwapAmount,
  hasGuideDepositFunds,
  isGuideVaultOffer,
  pickGuideSwapFrom,
} from './earnGuide.utils';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnGuideState, IEarnGuideStep } from './earnGuide.utils';
import type { IEarnGuide } from './earnGuideStore';

const copy = EARN_DESKTOP_DEMO_COPY;
const PANEL_WIDTH = 360;
// A step's explanation and buttons start under its name, past the mark
const MARK_SIZE = 24;
const MARK_GAP = 12;
const GAS_POLL_MS = 8000;
// The coin the fees are paid in, as Buy and Receive are asked for it
const GAS_TOKEN = { address: '', symbol: 'ETH' } as const;
const DEPOSIT_TOKEN = {
  address: EARN_GUIDE_TOKEN_ADDRESS,
  symbol: EARN_GUIDE_SYMBOL,
} as const;
type IGuideToken = typeof GAS_TOKEN | typeof DEPOSIT_TOKEN;
const SKIP_TOAST_ID = 'earn-guide-skipped';
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

type IGuideStepStatus = 'done' | 'current' | 'upcoming';

const getStepStatus = (
  state: IEarnGuideState,
  step: IEarnGuideStep,
): IGuideStepStatus => {
  if (state.done[step - 1]) {
    return 'done';
  }
  return step === state.current ? 'current' : 'upcoming';
};

function StepMarkFace({
  step,
  status,
}: {
  step: IEarnGuideStep;
  status: IGuideStepStatus;
}) {
  if (status === 'done') {
    return <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />;
  }
  const isCurrent = status === 'current';
  return (
    <YStack
      w={MARK_SIZE}
      h={MARK_SIZE}
      borderRadius="$full"
      bg={isCurrent ? '$bgPrimary' : undefined}
      borderWidth={isCurrent ? 0 : 1.5}
      borderColor="$neutral7"
      ai="center"
      jc="center"
    >
      <SizableText
        size="$bodyMdMedium"
        // The primary button's pair: the number reads on the mark in both themes
        color={isCurrent ? '$textInverse' : '$textSubdued'}
      >
        {step}
      </SizableText>
    </YStack>
  );
}

/**
 * A step's number in a circle; a done step's check takes its place. As the
 * guide moves on, the new mark fades in over the old one as it fades out
 */
function StepMark({
  step,
  status,
}: {
  step: IEarnGuideStep;
  status: IGuideStepStatus;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <StepMarkFace step={step} status={status} />;
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
          <StepMarkFace step={step} status={status} />
        </YStack>
      </AnimatePresence>
    </YStack>
  );
}

type IGuideStepAction = {
  testID: string;
  label: string;
  onPress: () => void;
};

const STEP_LABEL_SIZE = {
  done: '$bodyLg',
  current: '$headingMd',
  upcoming: '$bodyLgMedium',
} as const;

/**
 * One step of the list. A done one is its check and its name. The others
 * open and close on a press of their name: open, a step says what it is for
 * and has the buttons that do it. The guide opens the current step itself
 */
function StepRow({
  step,
  status,
  isOpen,
  label,
  info,
  actions,
  onToggle,
}: {
  step: IEarnGuideStep;
  status: IGuideStepStatus;
  isOpen: boolean;
  label: string;
  info: string;
  /** The ways to do the step, the first the one this wallet can use now */
  actions: IGuideStepAction[];
  onToggle: (step: IEarnGuideStep) => void;
}) {
  const reduceMotion = useReducedMotion();
  const handleToggle = useCallback(() => onToggle(step), [onToggle, step]);
  const isDone = status === 'done';
  const head = (
    <>
      <StepMark step={step} status={status} />
      <SizableText
        testID={`earn-guide-step-${step}-label`}
        flex={1}
        size={STEP_LABEL_SIZE[status]}
        // A done step steps back, so the eye lands on the one to do
        color={isDone ? '$textSubdued' : '$text'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </>
  );
  if (isDone) {
    return (
      <XStack
        testID={`earn-guide-step-${step}`}
        px="$3"
        py="$2.5"
        gap={MARK_GAP}
        ai="center"
      >
        {head}
      </XStack>
    );
  }
  return (
    <YStack
      testID={`earn-guide-step-${step}`}
      aria-current={status === 'current' ? 'step' : undefined}
      borderRadius="$3"
      borderCurve="continuous"
      bg={isOpen ? '$bgStrong' : undefined}
    >
      <XStack
        testID={`earn-guide-step-${step}-toggle`}
        role="button"
        aria-expanded={isOpen}
        px="$3"
        py="$2.5"
        gap={MARK_GAP}
        ai="center"
        borderRadius="$3"
        borderCurve="continuous"
        cursor="pointer"
        userSelect="none"
        hoverStyle={isOpen ? undefined : { bg: '$bgHover' }}
        pressStyle={isOpen ? undefined : { bg: '$bgActive' }}
        onPress={handleToggle}
        {...buildKeyboardPressProps(handleToggle, -2)}
      >
        {head}
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$5"
          color="$iconSubdued"
        />
      </XStack>
      {isOpen ? (
        <YStack
          pl={MARK_SIZE + MARK_GAP}
          ml="$3"
          pr="$3"
          pb="$3"
          gap="$3"
          {...(reduceMotion
            ? undefined
            : {
                transition: 'quick',
                animateOnly: ANIMATE_ONLY_OPACITY,
                enterStyle: HIDDEN_STYLE,
              })}
        >
          <SizableText
            testID={`earn-guide-step-${step}-info`}
            size="$bodyMd"
            color="$textSubdued"
          >
            {info}
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            {actions.map((action, index) => (
              <Button
                key={action.testID}
                testID={action.testID}
                size="medium"
                variant={index === 0 ? 'primary' : 'secondary'}
                iconAfter={index === 0 ? 'ArrowRightOutline' : undefined}
                onPress={action.onPress}
              >
                {action.label}
              </Button>
            ))}
          </XStack>
        </YStack>
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

// While step 1 waits the checklist checks the account itself, so the ETH
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

// While step 3 waits for something to deposit the checklist checks the
// account's USDC on Base the same way
function useGuideDepositPoll({
  scope,
  accountId,
  networkId,
  enabled,
}: {
  scope: string;
  accountId: string;
  networkId: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!accountId || !enabled) {
      return undefined;
    }
    let isStopped = false;
    const check = async () => {
      try {
        const [detail] =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: [EARN_GUIDE_TOKEN_ADDRESS],
          });
        if (!isStopped && detail) {
          earnGuideStore.setPolledDeposit({
            scope,
            amount: new BigNumber(detail.balanceParsed ?? 0).toNumber() || 0,
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
  }, [accountId, enabled, networkId, scope]);
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
  const isWaitingForDeposit = hasWallet && !state.done[2] && !isPreview;

  useGuideGasPoll({
    scope,
    account: earnAccount?.account,
    networkId,
    enabled: isWaitingForGas,
  });

  // What the wallet holds on every network Earn offers on: step 1's Swap
  // starts from it, and step 3 reads from it whether there is anything to
  // deposit (USDC on Base, or a token the Earn window swaps or bridges)
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
  const pay = usePayTokens({
    accountId,
    networkId,
    depositSymbol: EARN_GUIDE_SYMBOL,
    enabled: isWaitingForGas || isWaitingForDeposit,
    acrossNetworks: true,
  });
  const swapFrom = useMemo(
    () => pickGuideSwapFrom(pay.heldTokens, networkId),
    [networkId, pay.heldTokens],
  );
  const hasDepositFunds =
    !pay.isLoaded ||
    hasGuideDepositFunds(pay.heldTokens, networkId) ||
    (guide.polledDeposit ?? 0) >= EARN_GUIDE_MIN_DEPOSIT_USD;
  const needsFunds = isPreview
    ? guide.previewNeedsFunds
    : isWaitingForDeposit && !hasDepositFunds;

  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );
  const networkLogoURI = network?.logoURI;
  // Step 1's ways to the ETH: Swap for a wallet that holds something on
  // another network (it opens on a bridge from there to ETH on Base, on the
  // amount the suggested ETH costs), Buy with money, Receive from an
  // exchange or another wallet
  const handleSwap = useCallback(async () => {
    if (!swapFrom) {
      return;
    }
    const heldGas = pay.heldTokens.find(
      (item) =>
        item.token.isNative &&
        item.token.symbol.toUpperCase() === GAS_TOKEN.symbol &&
        new BigNumber(item.priceUsd).gt(0),
    );
    const [toToken, fromNetwork, gasPriceUsd] = await Promise.all([
      backgroundApiProxy.serviceToken.getNativeToken({ networkId, accountId }),
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: swapFrom.networkId,
      }),
      heldGas
        ? heldGas.priceUsd
        : backgroundApiProxy.serviceSwap
            .fetchSwapTokenDetails({
              networkId,
              contractAddress: GAS_TOKEN.address,
              currency: USD_CURRENCY_ID,
            })
            .then((details) => details?.[0]?.price)
            .catch(() => undefined),
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
        fromAmount: getGuideSwapAmount({
          fromAmount: swapFrom.amount,
          fromPriceUsd: swapFrom.priceUsd,
          gasPriceUsd,
        }),
        swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
        swapSource: ESwapSource.EARN,
      },
    });
  }, [
    accountId,
    navigation,
    networkId,
    networkLogoURI,
    pay.heldTokens,
    swapFrom,
  ]);

  // Buy opens the purchase of the very coin the step is about, as the
  // token's own page does, instead of a list to find it in
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const { result: canBuyGas } = useSupportToken(
    networkId,
    GAS_TOKEN.address,
    'buy',
    isWaitingForGas,
  );
  const { result: canBuyDeposit } = useSupportToken(
    networkId,
    DEPOSIT_TOKEN.address,
    'buy',
    needsFunds && !isPreview,
  );
  const isOpeningBuyRef = useRef(false);
  const handleBuy = useCallback(
    async (token: IGuideToken) => {
      if (!accountId || !walletId || isOpeningBuyRef.current) {
        return;
      }
      isOpeningBuyRef.current = true;
      try {
        await openFiatCryptoWidget({
          type: 'buy',
          networkId,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          accountId,
          walletId,
          source: 'earn',
          isSoftwareWalletOnlyUser: Boolean(isSoftwareWalletOnlyUser),
        });
      } finally {
        isOpeningBuyRef.current = false;
      }
    },
    [accountId, isSoftwareWalletOnlyUser, networkId, walletId],
  );
  const handleReceive = useCallback(
    async (target: IGuideToken) => {
      if (!accountId || !walletId) {
        return;
      }
      const token = target.address
        ? await backgroundApiProxy.serviceToken.getToken({
            networkId,
            accountId,
            tokenIdOnNetwork: target.address,
          })
        : await backgroundApiProxy.serviceToken.getNativeToken({
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
    },
    [accountId, navigation, networkId, walletId],
  );

  // Which step is open: the current one, until the user opens another or
  // closes it. Once that other one is done, or the guide moves on, the
  // current one opens itself again
  const [openPick, setOpenPick] = useState<{
    at: IEarnGuideStep;
    step?: IEarnGuideStep;
  }>();
  const isPickKept =
    openPick?.at === current &&
    !(openPick.step && state.done[openPick.step - 1]);
  const openStep = isPickKept ? openPick?.step : current;
  const handleToggle = useCallback(
    (step: IEarnGuideStep) =>
      setOpenPick({ at: current, step: openStep === step ? undefined : step }),
    [current, openStep],
  );

  useGuideDepositPoll({
    scope,
    accountId,
    networkId,
    enabled:
      needsFunds &&
      !isPreview &&
      [current, openStep].some((step) => step === 3),
  });

  // Steps 2 and 3 open the Earn window on USDC on Base, its vaults beside
  // the form: on the vault the user picked there, else the PO's example
  // once the offers are in (the best rate there otherwise)
  const { offers } = useEarnRouterOffers({
    symbol: EARN_GUIDE_SYMBOL,
    networkId,
    enabled: [current, openStep].some((step) => step === 2 || step === 3),
  });
  const offerKey = useMemo(
    () => guide.saved.vaultKey ?? offers.find(isGuideVaultOffer)?.key,
    [guide.saved.vaultKey, offers],
  );
  const handleOpenVaults = useCallback(() => {
    EarnNavigation.pushToEarnOffersDeposit(navigation, {
      symbol: EARN_GUIDE_SYMBOL,
      networkId,
      offerKey,
      wide: true,
    });
  }, [navigation, networkId, offerKey]);

  // The last step is done by going there after the deposit; My portfolio
  // tells the guide itself, and the guide ends with it
  const handleOpenPortfolio = useCallback(() => {
    if (isPreview && current === 4) {
      earnGuideStore.setPreview(undefined);
    }
    EarnNavigation.pushToEarnPositions(navigation);
  }, [current, isPreview, navigation]);

  const stepActions = useMemo<
    Record<IEarnGuideStep, IGuideStepAction[]>
  >(() => {
    const text = (id: ETranslations) => intl.formatMessage({ id });
    const buy = (testID: string, token: IGuideToken): IGuideStepAction => ({
      testID,
      label: text(ETranslations.global_buy),
      onPress: () => void handleBuy(token),
    });
    const receive = (testID: string, token: IGuideToken): IGuideStepAction => ({
      testID,
      label: text(ETranslations.global_receive),
      onPress: () => void handleReceive(token),
    });
    let gasActions: IGuideStepAction[];
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
        ...(canBuyGas || isPreview ? [buy('earn-guide-buy', GAS_TOKEN)] : []),
        receive('earn-guide-receive', GAS_TOKEN),
      ];
    }
    return {
      1: gasActions,
      2: [
        {
          testID: 'earn-guide-vault',
          label: copy.guideChooseVault,
          onPress: handleOpenVaults,
        },
      ],
      // With nothing to deposit the Earn window's form is a dead end: the
      // step gives the ways to the USDC first, then the deposit
      3: needsFunds
        ? [
            ...(canBuyDeposit || isPreview
              ? [buy('earn-guide-buy-deposit', DEPOSIT_TOKEN)]
              : []),
            receive('earn-guide-receive-deposit', DEPOSIT_TOKEN),
          ]
        : [
            {
              testID: 'earn-guide-deposit',
              label: text(ETranslations.earn_deposit),
              onPress: handleOpenVaults,
            },
          ],
      4: [
        {
          testID: 'earn-guide-portfolio',
          label: copy.guideGoToPortfolio,
          onPress: handleOpenPortfolio,
        },
      ],
    };
  }, [
    canBuyDeposit,
    canBuyGas,
    handleBuy,
    handleOpenPortfolio,
    handleOpenVaults,
    handleReceive,
    handleSwap,
    hasWallet,
    intl,
    isPreview,
    needsFunds,
    showAccountSelector,
    swapFrom,
  ]);
  const stepInfo: Record<IEarnGuideStep, string> = {
    1: copy.guideGasInfo(EARN_GUIDE_SUGGESTED_GAS),
    2: copy.guideVaultInfo,
    3: needsFunds ? copy.guideFundsInfo : copy.guideDepositInfo,
    4: copy.guidePortfolioInfo,
  };

  // Open until the user folds it, or until the page is scrolled, when it
  // folds by itself out of the way of the list. A phone-wide screen starts
  // on the pill, where the open list would cover the page
  const isCollapsed = (guide.isCollapsed ?? !media.gtMd) || guide.isYielding;
  const handleCollapse = useCallback(
    () => earnGuideStore.setCollapsed(scope, true),
    [scope],
  );
  const handleExpand = useCallback(
    () => earnGuideStore.setCollapsed(scope, false),
    [scope],
  );
  // Skipped, the guide says when it is back and takes the skip back on Undo
  const undoLabel = intl.formatMessage({ id: ETranslations.menu_undo });
  const handleSkip = useCallback(() => {
    const undo = earnGuideStore.skip(scope);
    if (!undo) {
      return;
    }
    // Dismissed by its id, the toast shows again on the next skip: a toast
    // id still in use is otherwise ignored for its whole duration
    const handleUndo = () => {
      undo();
      Toast.dismiss(SKIP_TOAST_ID);
    };
    Toast.message({
      toastId: SKIP_TOAST_ID,
      title: copy.guideSkipped,
      actionsAlign: 'left',
      actions: (
        <Button
          testID="earn-guide-undo"
          size="small"
          variant="secondary"
          onPress={handleUndo}
        >
          {undoLabel}
        </Button>
      ),
    });
  }, [scope, undoLabel]);
  const handleTutorial = useCallback(
    () => openUrlExternal(EARN_GUIDE_TUTORIAL_URL),
    [],
  );
  const collapseLabel = intl.formatMessage({
    id: ETranslations.global_collapse,
  });
  const total = EARN_GUIDE_STEPS.length;
  const doneCount = state.done.filter(Boolean).length;
  // The window and the pill take each other's place: one sinks away, then
  // the other rises in
  const enterProps = reduceMotion
    ? undefined
    : ({
        transition: 'quick',
        animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
        enterStyle: RISE_STYLE,
        exitStyle: RISE_STYLE,
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
          aria-label={`${copy.guideTitle} ${doneCount}/${total}`}
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
          <ProgressRing done={doneCount} total={total} />
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {copy.guideTitle}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {`${doneCount}/${total}`}
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
        maxHeight="100%"
        borderRadius="$5"
        borderCurve="continuous"
        overflow="hidden"
        {...FLOATING_SURFACE}
        {...enterProps}
      >
        <YStack px="$5" pt="$4" pb="$4" gap="$3">
          <XStack ai="center" gap="$2.5">
            <Icon name="BookOpenOutline" size="$6" color="$icon" />
            <SizableText size="$headingXl" flex={1} numberOfLines={1}>
              {copy.guideTitle}
            </SizableText>
            <IconButton
              testID="earn-guide-collapse"
              aria-label={collapseLabel}
              title={collapseLabel}
              icon="MinusSmallOutline"
              variant="tertiary"
              size="small"
              // The button's own inset, so the icon ends on the edge
              mr="$-1.5"
              onPress={handleCollapse}
            />
          </XStack>
          {/* What the guide is for and how far it is on one line, over the
              bar that draws the same */}
          <YStack gap="$2">
            <XStack ai="baseline" gap="$3">
              <SizableText size="$bodyLg" color="$textSubdued" flex={1}>
                {copy.guideSubtitle}
              </SizableText>
              <SizableText
                testID="earn-guide-count"
                aria-label={copy.guideProgress(doneCount, total)}
                size="$bodyLgMedium"
              >
                {`${doneCount}/${total}`}
              </SizableText>
            </XStack>
            <Progress
              h={6}
              value={(doneCount / total) * 100}
              indicatorColor="$iconSuccess"
              animated={!reduceMotion}
            />
          </YStack>
        </YStack>
        <Divider mx="$5" />
        {/* The steps scroll between the heading and the links in a window
            too short for all of it */}
        <ScrollView flexShrink={1}>
          <YStack px="$2" py="$2" gap="$0.5">
            {EARN_GUIDE_STEPS.map((step) => (
              <StepRow
                key={step}
                step={step}
                status={getStepStatus(state, step)}
                isOpen={openStep === step}
                label={copy.guideSteps[step - 1]}
                info={stepInfo[step]}
                actions={stepActions[step]}
                onToggle={handleToggle}
              />
            ))}
          </YStack>
        </ScrollView>
        <Divider mx="$5" />
        <XStack px="$5" py="$3" ai="center" jc="space-between" gap="$3">
          <Button
            testID="earn-guide-tutorial"
            size="small"
            variant="tertiary"
            color="$text"
            iconAfter="ArrowTopRightOutline"
            onPress={handleTutorial}
          >
            {copy.guideTutorial}
          </Button>
          <Button
            testID="earn-guide-skip"
            size="small"
            variant="tertiary"
            onPress={handleSkip}
          >
            {copy.guideSkip}
          </Button>
        </XStack>
      </YStack>
    );
  }

  return (
    // Over the page's bottom right corner, outside what scrolls, as tall as
    // the page at most. Only the list itself takes the pointer
    <YStack
      position="absolute"
      top="$6"
      right="$6"
      bottom="$6"
      zIndex={1}
      ai="flex-end"
      jc="flex-end"
      pointerEvents="box-none"
      $md={{ top: '$4', right: '$4', bottom: '$4', left: '$4' }}
    >
      <AnimatePresence exitBeforeEnter>{content}</AnimatePresence>
    </YStack>
  );
}

/**
 * The guide for an account without positions: a window of four steps
 * floating over the DeFi home's bottom right corner, each opening the app's
 * own window for it (Swap, Buy or Receive for the ETH on Base, the Earn
 * window for the vault and the deposit, My portfolio for the position). A
 * step ticks itself when the account shows it done. The window folds to a
 * pill with its progress, by its button or as the page is scrolled, can be
 * skipped until the app is opened again, and goes once the last step is done
 */
export function EarnGuideChecklist() {
  const guide = useEarnGuide();
  if (!guide.isShown) {
    return null;
  }
  return <EarnGuideChecklistView guide={guide} />;
}
