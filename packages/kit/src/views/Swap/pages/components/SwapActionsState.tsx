import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  BUTTON_DISABLED_COLORS,
  Badge,
  Button,
  DashText,
  ESwitchSize,
  Icon,
  LottieView,
  Page,
  Popover,
  SizableText,
  Stack,
  Switch,
  Tooltip,
  XStack,
  YStack,
  resetToRoute,
  runAfterActionListClose,
  useIsOverlayPage,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToAnotherAccountAddressAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  isSwapQuoteProvenForCurrentRequest,
  isSwapQuoteRequestForCurrentInput,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import { shouldRedirectOnboardingToTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import {
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSettledSwapRecipientRequired } from '../../hooks/useSettledSwapRecipientRequired';
import {
  useSwapAddressInfo,
  useSwapRecipientAddressInfo,
} from '../../hooks/useSwapAccount';
import {
  getSwapRecipientValidationAccountId,
  shouldShowSwapRecipientEntry,
} from '../../hooks/useSwapAccount.utils';
import { useSwapDepositEntryPress } from '../../hooks/useSwapDepositEntry';
import {
  shouldBlockSwapActionForIncognitoRecipientInput,
  shouldEnableSwapIncognitoRecipientValidation,
  shouldShowSwapIncognitoRecipientInput,
  useSwapIncognitoRecipientInput,
} from '../../hooks/useSwapIncognitoRecipientInput';
import {
  useSwapActionState,
  useSwapQuoteProgressState,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { SwapTestIDs } from '../../testIDs';
import { buildSwapIncognitoSettingsUpdate } from '../../utils/incognitoSettings';

import { SwapIncognitoRecipientInput } from './SwapIncognitoRecipientInput';
import { PercentageStageOnKeyboard } from './SwapInputContainer';
import { SwapSmoothReveal } from './SwapSmoothReveal';

interface ISwapActionsStateProps {
  disabled?: boolean;
  forceNoConnectWallet?: boolean;
  forceQuoteActionLoading?: boolean;
  onRefreshQuote?: () => void;
  onPreSwap: () => void;
  onOpenRecipientAddress: () => void;
  onSelectPercentageStage?: (stage: number) => void;
  stockRecipientSnapshotScope?: string;
}

// cspell:ignore ellipsize

function IncognitoTooltipText({
  intro,
  description,
  onAction,
}: {
  intro: string;
  description: string;
  onAction?: (url: string) => void;
}) {
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intro}
      </SizableText>
      <FormatHyperlinkText
        autoExecuteParsedAction={false}
        onAction={onAction}
        size="$bodyMd"
        color="$textSubdued"
        urlTextProps={{
          color: '$textInfo',
        }}
        underlineTextProps={{
          color: '$textInfo',
        }}
      >
        {description}
      </FormatHyperlinkText>
    </YStack>
  );
}

function IncognitoPopoverContent({
  intro,
  description,
}: {
  intro: string;
  description: string;
}) {
  const { closePopover } = usePopoverContext();
  const handleAction = useCallback(
    (url: string) => {
      void runAfterActionListClose(
        () => closePopover?.(),
        () => openUrlExternal(url),
        { waitForAnimation: false },
      );
    },
    [closePopover],
  );

  return (
    <Stack px="$5" pt="$1" pb="$5">
      <IncognitoTooltipText
        intro={intro}
        description={description}
        onAction={handleAction}
      />
    </Stack>
  );
}

// The action button draws its own content, so Button would fade it when
// disabled; it takes Button's disabled fill instead. Passed as plain props and
// only while disabled: on web, Tamagui's `disabledStyle` keys off the
// aria-disabled attribute being present, which Button renders even when the
// button is enabled.
const ACTION_BUTTON_DISABLED_STYLE = {
  opacity: 1,
  bg: BUTTON_DISABLED_COLORS.bg,
} as const;

// On web, new content in the action button (a label, or the quote dots) rises
// into place, and when the fill stays the same the old content leaves upward
// a little quicker. The fill switches in the same frame: the button flips
// between a light fill with dark content and a black fill with white text, so
// a fill tween would first show the new content on the wrong fill, and across
// such a flip the old content would sit on the wrong fill and is skipped. The
// fade and the rise run apart, so the text reads while it still glides up.
const CONTENT_FADE_MS = 180;
const CONTENT_RISE_MS = 260;
const CONTENT_RISE_PX = 8;
const CONTENT_EXIT_MS = 120;
const CONTENT_EXIT_PX = 4;
const CONTENT_EXIT_LAYER_STYLE =
  'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none';

function useActionContentMotion(contentKey: string | null, fillKey: boolean) {
  const ref = useRef<HTMLElement>(null);
  const previous = useRef({ contentKey, fillKey });
  const shown = useRef<{ node: Element; text: string } | null>(null);
  const animations = useRef<Animation[]>([]);
  const exitLayer = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      return;
    }
    const button = ref.current;
    const content = button?.firstElementChild;
    const last = previous.current;
    const before = shown.current;
    previous.current = { contentKey, fillKey };
    shown.current = content
      ? { node: content, text: content.textContent ?? '' }
      : null;
    if (last.contentKey === contentKey || !button || !content) {
      return;
    }
    const reduced = globalThis.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // The old content is already out of the tree (or holds the new text), so
    // a copy of it leaves from an overlay on the button.
    exitLayer.current?.remove();
    exitLayer.current = null;
    if (before && last.fillKey === fillKey) {
      const copy = before.node.cloneNode(true) as Element;
      if (before.node === content) {
        copy.textContent = before.text;
      }
      const layer = document.createElement('div');
      layer.style.cssText = CONTENT_EXIT_LAYER_STYLE;
      layer.append(copy);
      button.append(layer);
      exitLayer.current = layer;
      const removeLayer = () => layer.remove();
      copy
        .animate(
          reduced
            ? { opacity: [1, 0] }
            : {
                opacity: [1, 0],
                transform: [
                  'translateY(0)',
                  `translateY(-${CONTENT_EXIT_PX}px)`,
                ],
              },
          { duration: CONTENT_EXIT_MS, easing: 'ease-out' },
        )
        .finished.then(removeLayer, removeLayer);
    }

    // A change during an entrance carries on from where that entrance is, so
    // quick successive changes don't drop the content back to invisible.
    const [fade, rise] = animations.current;
    const inFlight = animations.current.some(
      (animation) => animation.playState === 'running',
    );
    const progress = (animation?: Animation) =>
      animation?.effect?.getComputedTiming().progress ?? 1;
    const fromOpacity = inFlight ? progress(fade) : 0;
    const fromY = inFlight
      ? CONTENT_RISE_PX * (1 - progress(rise))
      : CONTENT_RISE_PX;
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [
      content.animate(
        { opacity: [fromOpacity, 1] },
        { duration: CONTENT_FADE_MS * (1 - fromOpacity), easing: 'ease-out' },
      ),
    ];
    if (!reduced) {
      animations.current.push(
        content.animate(
          { transform: [`translateY(${fromY}px)`, 'translateY(0)'] },
          {
            duration: CONTENT_RISE_MS * (fromY / CONTENT_RISE_PX),
            easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
          },
        ),
      );
    }
  }, [contentKey, fillKey]);
  return ref;
}

const SwapActionsState = ({
  disabled,
  forceNoConnectWallet,
  forceQuoteActionLoading,
  onRefreshQuote,
  onPreSwap,
  onOpenRecipientAddress,
  onSelectPercentageStage,
  stockRecipientSnapshotScope,
}: ISwapActionsStateProps) => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const [quoteActionLock] = useSwapQuoteActionLockAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [, setSwapManualSelectQuoteProvider] =
    useSwapManualSelectQuoteProvidersAtom();
  const [quoteEventTotalCount, setSwapQuoteEventTotalCount] =
    useSwapQuoteEventTotalCountAtom();
  const [, setSwapQuoteList] = useSwapQuoteListAtom();
  const [swapToAnotherAccountAddress] = useSwapToAnotherAccountAddressAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  // Publishing a recipient must not change its own validation account or readiness.
  const recipientValidationAddressInfo = useSwapAddressInfo(
    ESwapDirectionType.TO,
    {
      useCustomRecipientAddress: false,
    },
  );
  const {
    cleanQuoteInterval,
    closeQuoteEvent,
    loadSwapSelectTokenDetail,
    requestSelectedTokenBalanceRefresh,
    quoteAction,
  } = useSwapActions().current;
  const swapActionState = useSwapActionState();
  const noConnectWallet = Boolean(
    forceNoConnectWallet || swapActionState.noConnectWallet,
  );
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapSlippageRef = useRef(slippageItem);
  const hasEverShownCostSavingsRef = useRef(false);
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [
    {
      swapEnableRecipientAddress,
      swapIncognitoMode,
      swapToAnotherAccountSwitchOn,
    },
    setSettings,
  ] = useSettingsAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { quoteLoading, quoteEventFetching } = useSwapQuoteProgressState();
  const swapRecipientAddressInfo = useSwapRecipientAddressInfo(
    swapEnableRecipientAddress,
  );
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
  const themeVariant = useThemeVariant();
  const [desktopActionWidth, setDesktopActionWidth] = useState<number>();

  const isModalPage = useIsOverlayPage();
  const { gtMd, md } = useMedia();
  const isDesktopModalPage = isModalPage && !md;
  const incognitoHelpLink = useHelpLink({
    path: 'articles/14430164',
  });
  const incognitoTitle = intl.formatMessage({
    id: ETranslations.trade_privacy_mode,
  });
  const incognitoTooltipIntro = intl.formatMessage({
    id: ETranslations.trade_privacy_mode_tooltips,
  });
  const incognitoTooltipDescription = useMemo(
    () =>
      `${intl.formatMessage({
        id: ETranslations.trade_privacy_mode_compliance__desc,
      })} <url>${incognitoHelpLink}<underline>${intl.formatMessage({
        id: ETranslations.trade_incognito_read_more,
      })}</underline></url>`,
    [incognitoHelpLink, intl],
  );
  const incognitoTooltipContent = useMemo(
    () => (
      <IncognitoTooltipText
        intro={incognitoTooltipIntro}
        description={incognitoTooltipDescription}
        onAction={openUrlExternal}
      />
    ),
    [incognitoTooltipDescription, incognitoTooltipIntro],
  );
  const incognitoPopoverContent = useMemo(
    () => (
      <IncognitoPopoverContent
        intro={incognitoTooltipIntro}
        description={incognitoTooltipDescription}
      />
    ),
    [incognitoTooltipDescription, incognitoTooltipIntro],
  );

  // OK-58977: `swapProviderSupportReceiveAddressAtom` is computed from the
  // currently selected quote and falls back to "supported" whenever no quote
  // result is selected — which is the case for the whole input-debounce plus
  // quoting window on every quote refresh. Trusting that fallback used to
  // expand the recipient entry mid-quote and collapse it again right after.
  // Hold the last definitive value while a quote for the current input is
  // pending, and adopt the atom value once that quote settles — either with
  // a result (the provider's real support) or definitively without one
  // (back to the fallback) — so a previous pair's value cannot outlive its
  // own quote cycle. `quoteActionLock` matching the current input separates
  // "settled with no result" from the pre-quote debounce window, and
  // `actionLock`/`quoteEventCompleted` keep the request-starting interval
  // (lock written, fetching flag not yet set while `closeApproving` awaits)
  // counted as pending.
  const quoteRequestMatchesCurrentInput = isSwapQuoteRequestForCurrentInput({
    currentAccountId: swapFromAddressInfo?.accountInfo?.account?.id,
    currentAddress: swapFromAddressInfo?.address,
    currentReceivingAddress: swapToAddressInfo?.address,
    currentSwapType: swapTypeSwitch,
    fromAmount: fromTokenAmount.value,
    toAmount: toTokenAmount.value,
    fromToken,
    toToken,
    quoteKind: quoteActionLock?.kind ?? ESwapQuoteKind.SELL,
    quoteRequest: quoteActionLock,
  });
  const isQuoteSettledWithoutResult =
    !currentQuoteRes &&
    !quoteLoading &&
    !quoteEventFetching &&
    !quoteActionLock.actionLock &&
    quoteEventCompleted &&
    quoteRequestMatchesCurrentInput;
  const quoteProvenForCurrentInput = isSwapQuoteProvenForCurrentRequest({
    quote: currentQuoteRes,
    quoteEventTotalCount,
    quoteLoading,
    quoteEventFetching,
    quoteActionLocked: Boolean(quoteActionLock.actionLock),
    requestMatchesCurrentInput: quoteRequestMatchesCurrentInput,
  });
  const quoteSettledWithResult =
    quoteProvenForCurrentInput &&
    quoteEventCompleted &&
    !quoteLoading &&
    !quoteEventFetching;
  const settledProviderSupportRef = useRef(swapProviderSupportReceiveAddress);
  if (quoteSettledWithResult || isQuoteSettledWithoutResult) {
    settledProviderSupportRef.current = swapProviderSupportReceiveAddress;
  }
  const providerSupportReceiveAddressSettled =
    settledProviderSupportRef.current;

  // Hold the "recipient required" verdict the same way as provider support
  // above: the action button's shouldEnterRecipient flips false during every
  // quote refresh/loading window, which would collapse and re-expand the
  // recipient entry on each quote cycle. Adopt a new verdict only when a
  // quote settles and the target address resolution is ready, so the row
  // keeps its pre-quote state while quoting and only moves when the settled
  // outcome actually changed. (OK-58326)
  const recipientRequiredSettled = useSettledSwapRecipientRequired({
    swapType: swapTypeSwitch,
    fromToken,
    toToken,
    sourceAccountId: swapFromAddressInfo?.accountInfo?.account?.id,
    // Raw selection atom: the hook itself rejects a retained quote whose
    // token pair no longer matches the current selection.
    quoteResult: currentQuoteRes,
    // Active-request proof: see isSwapQuoteProvenForCurrentRequest for why
    // event membership, the lock match, and the request-starting interval all
    // have to be checked together.
    quoteProvenForCurrentInput,
    quoteSettledWithoutResult: isQuoteSettledWithoutResult,
    isAddressInfoReady: swapToAddressInfo.isAddressInfoReady,
    hasTargetAddress: Boolean(swapToAddressInfo.address),
    noConnectWallet,
  });

  const shouldShowRecipientForCurrentState = useMemo(
    () =>
      shouldShowSwapRecipientEntry({
        swapType: swapTypeSwitch,
        incognitoMode: swapIncognitoMode,
        recipientAddressSettingOn: swapEnableRecipientAddress,
        recipientRequired: recipientRequiredSettled,
        providerSupportReceiveAddress: Boolean(
          providerSupportReceiveAddressSettled,
        ),
        hasFromToken: Boolean(fromToken),
        hasToToken: Boolean(toToken),
      }),
    [
      swapIncognitoMode,
      swapEnableRecipientAddress,
      recipientRequiredSettled,
      providerSupportReceiveAddressSettled,
      fromToken,
      swapTypeSwitch,
      toToken,
    ],
  );

  // Stock token switches intentionally clear the pay token while the new
  // network-scoped token is resolved. Keep an already visible recipient row
  // mounted through that transition; otherwise the temporary missing token
  // makes the row collapse and re-expand even though the setting is enabled.
  const recipientVisibilityScopeRef = useRef({
    swapType: swapTypeSwitch,
    visible: false,
  });
  if (recipientVisibilityScopeRef.current.swapType !== swapTypeSwitch) {
    recipientVisibilityScopeRef.current = {
      swapType: swapTypeSwitch,
      visible: false,
    };
  }
  if (shouldShowRecipientForCurrentState) {
    recipientVisibilityScopeRef.current.visible = true;
  }
  if (!swapEnableRecipientAddress) {
    recipientVisibilityScopeRef.current.visible = false;
  }
  const shouldKeepRecipientVisibleDuringStockTokenTransition = Boolean(
    swapTypeSwitch === ESwapTabSwitchType.STOCK &&
    recipientVisibilityScopeRef.current.visible &&
    swapEnableRecipientAddress &&
    (!fromToken || !toToken),
  );
  const shouldShowRecipient =
    shouldShowRecipientForCurrentState ||
    shouldKeepRecipientVisibleDuringStockTokenTransition;

  const shouldShowIncognitoRecipientInput = useMemo(
    () =>
      shouldShowSwapIncognitoRecipientInput({
        incognitoMode: swapIncognitoMode,
        providerSupportsRecipient: providerSupportReceiveAddressSettled,
        swapType: swapTypeSwitch,
      }),
    [swapIncognitoMode, providerSupportReceiveAddressSettled, swapTypeSwitch],
  );

  const incognitoRecipientNetworkId =
    toToken?.networkId ?? recipientValidationAddressInfo.networkId;
  const shouldValidateIncognitoRecipientInput = useMemo(
    () =>
      shouldEnableSwapIncognitoRecipientValidation({
        hasFromToken: Boolean(fromToken),
        hasToToken: Boolean(toToken),
        isAddressInfoReady:
          recipientValidationAddressInfo.isRecipientValidationReady,
        networkId: incognitoRecipientNetworkId,
        providerSupportsRecipient: providerSupportReceiveAddressSettled,
        visible: shouldShowIncognitoRecipientInput,
      }),
    [
      fromToken,
      incognitoRecipientNetworkId,
      shouldShowIncognitoRecipientInput,
      providerSupportReceiveAddressSettled,
      recipientValidationAddressInfo.isRecipientValidationReady,
      toToken,
    ],
  );

  const clearRecipientAddressOnHide = useMemo(
    () => swapIncognitoMode && !shouldShowRecipient,
    [shouldShowRecipient, swapIncognitoMode],
  );

  const incognitoRecipientInput = useSwapIncognitoRecipientInput({
    isActive: isFocused,
    visible: shouldShowIncognitoRecipientInput,
    validationEnabled: shouldValidateIncognitoRecipientInput,
    clearRecipientAddressOnHide,
    networkId: incognitoRecipientNetworkId,
    validationScopeKey: recipientValidationAddressInfo.validationScopeKey,
    accountId: getSwapRecipientValidationAccountId({
      accountId: recipientValidationAddressInfo.accountInfo?.account?.id,
      accountAddress:
        recipientValidationAddressInfo.accountInfo?.account?.addressDetail
          ?.address,
      recipientAddress: recipientValidationAddressInfo.address,
    }),
    accountInfo:
      recipientValidationAddressInfo.accountInfo ??
      recipientValidationAddressInfo.activeAccount,
    address: swapToAnotherAccountAddress.address,
    swapToAnotherAccountSwitchOn,
  });
  const {
    errorTranslationId: incognitoRecipientErrorTranslationId,
    inputText: incognitoRecipientInputText,
    loading: incognitoRecipientLoading,
    onInputChange: handleIncognitoRecipientInputChange,
    queryResult: incognitoRecipientQueryResult,
  } = incognitoRecipientInput;

  const handleAddRecipientAddressToAddressBook = useCallback(() => {
    const recipientAddress = incognitoRecipientInputText.trim();
    const recipientNetworkId =
      toToken?.networkId ?? swapToAddressInfo.networkId;

    if (!recipientAddress || !recipientNetworkId) {
      return;
    }

    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.EditItemModal,
      params: {
        address: recipientAddress,
        networkId: recipientNetworkId,
        isAllowListed: true,
        onSaveSuccess: () => {
          handleIncognitoRecipientInputChange(incognitoRecipientInputText);
        },
      },
    });
  }, [
    handleIncognitoRecipientInputChange,
    incognitoRecipientInputText,
    navigation,
    swapToAddressInfo.networkId,
    toToken?.networkId,
  ]);

  const shouldBlockIncognitoRecipientAction =
    shouldBlockSwapActionForIncognitoRecipientInput({
      inputText: incognitoRecipientInput.inputText,
      isDepositAction: swapActionState.shouldDepositToTrade,
      isConnectWalletAction: noConnectWallet,
      loading: incognitoRecipientInput.loading,
      queryResult: incognitoRecipientInput.queryResult,
      validationEnabled: incognitoRecipientInput.enabled,
      visible: shouldShowIncognitoRecipientInput,
    });

  const refreshFromTokenBalance = useCallback(() => {
    void loadSwapSelectTokenDetail(
      ESwapDirectionType.FROM,
      swapFromAddressInfo,
      true,
    );
  }, [loadSwapSelectTokenDetail, swapFromAddressInfo]);
  // Withhold accountInfo while the cross-network account lookup is pending or
  // has no target result, so a tap resolves the right account from
  // activeAccount instead of opening Receive for the wrong network.
  const onDepositToTrade = useSwapDepositEntryPress({
    token: fromToken,
    accountInfo: swapFromAddressInfo.isAddressInfoReady
      ? swapFromAddressInfo.accountInfo
      : undefined,
    activeAccount: swapFromAddressInfo.activeAccount,
    onClose: refreshFromTokenBalance,
  });

  const shouldShowQuoteActionLoading =
    !noConnectWallet &&
    !swapActionState.isRefreshQuote &&
    !swapActionState.shouldDepositToTrade &&
    (swapActionState.isQuoteActionLoading || Boolean(forceQuoteActionLoading));
  const isActionDisabled = noConnectWallet
    ? shouldRedirectOnboardingToTravelMode()
    : Boolean(disabled) ||
      swapActionState.disabled ||
      swapActionState.isLoading ||
      shouldShowQuoteActionLoading ||
      shouldBlockIncognitoRecipientAction;

  const onActionHandlerBefore = useCallback(async () => {
    if (noConnectWallet) {
      if (platformEnv.isWebDappMode) {
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.ConnectWalletOptions,
        });
      } else {
        resetToRoute(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        });
      }
      return;
    }
    if (swapActionState.shouldDepositToTrade) {
      onDepositToTrade();
      return;
    }
    if (shouldBlockIncognitoRecipientAction) {
      return;
    }
    if (swapActionState.isRefreshQuote) {
      requestSelectedTokenBalanceRefresh();
      if (onRefreshQuote) {
        onRefreshQuote();
        return;
      }
      void quoteAction(
        swapSlippageRef.current,
        swapFromAddressInfo?.address,
        swapFromAddressInfo?.accountInfo?.account?.id,
        undefined,
        undefined,
        quoteActionLock.kind ?? currentQuoteRes?.kind ?? ESwapQuoteKind.SELL,
        true,
        swapToAddressInfo?.address,
        swapIncognitoMode,
      );
      return;
    }
    if (swapActionState.shouldEnterRecipient) {
      onOpenRecipientAddress();
      return;
    }
    onPreSwap();
  }, [
    currentQuoteRes?.kind,
    onDepositToTrade,
    navigation,
    onOpenRecipientAddress,
    onPreSwap,
    onRefreshQuote,
    quoteAction,
    quoteActionLock.kind,
    requestSelectedTokenBalanceRefresh,
    shouldBlockIncognitoRecipientAction,
    swapActionState.isRefreshQuote,
    swapActionState.shouldDepositToTrade,
    noConnectWallet,
    swapActionState.shouldEnterRecipient,
    swapIncognitoMode,
    swapFromAddressInfo?.accountInfo?.account?.id,
    swapFromAddressInfo?.address,
    swapToAddressInfo?.address,
  ]);

  const incognitoRecipientInputComponent = useMemo(
    () => (
      <SwapIncognitoRecipientInput
        visible={shouldShowIncognitoRecipientInput}
        errorTranslationId={incognitoRecipientErrorTranslationId}
        inputText={incognitoRecipientInputText}
        loading={incognitoRecipientLoading}
        onAddRecipientAddressToAddressBook={
          handleAddRecipientAddressToAddressBook
        }
        onOpenRecipientAddress={onOpenRecipientAddress}
        onInputChange={handleIncognitoRecipientInputChange}
        queryResult={incognitoRecipientQueryResult}
      />
    ),
    [
      handleIncognitoRecipientInputChange,
      handleAddRecipientAddressToAddressBook,
      incognitoRecipientErrorTranslationId,
      incognitoRecipientInputText,
      incognitoRecipientLoading,
      incognitoRecipientQueryResult,
      onOpenRecipientAddress,
      shouldShowIncognitoRecipientInput,
    ],
  );

  const showRecipientInMetaRow = useMemo(
    () =>
      !md &&
      swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
      swapTypeSwitch !== ESwapTabSwitchType.STOCK,
    [md, swapTypeSwitch],
  );

  const shouldShowRecipientInMetaRow = useMemo(
    () => showRecipientInMetaRow && shouldShowRecipient,
    [showRecipientInMetaRow, shouldShowRecipient],
  );

  const shouldShowRecipientInActionRow = useMemo(
    () => shouldShowRecipient && !showRecipientInMetaRow,
    [shouldShowRecipient, showRecipientInMetaRow],
  );

  const applyIncognitoModeChange = useCallback(
    (value: boolean) => {
      const nextSettings = buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress,
          swapIncognitoMode,
          swapToAnotherAccountSwitchOn,
        },
        value,
      );

      setSettings((settings) =>
        buildSwapIncognitoSettingsUpdate(settings, value),
      );

      cleanQuoteInterval();
      closeQuoteEvent(quoteActionLock.quoteRequestId);
      setSwapManualSelectQuoteProvider(undefined);
      setSwapQuoteEventTotalCount({ count: 0 });
      setSwapQuoteList([]);

      if (
        swapToAnotherAccountSwitchOn &&
        !nextSettings.swapToAnotherAccountSwitchOn
      ) {
        return;
      }

      void quoteAction(
        swapSlippageRef.current,
        swapFromAddressInfo?.address,
        swapFromAddressInfo?.accountInfo?.account?.id,
        undefined,
        undefined,
        currentQuoteRes?.kind ?? ESwapQuoteKind.SELL,
        true,
        swapToAddressInfo?.address,
        value,
      );
    },
    [
      cleanQuoteInterval,
      closeQuoteEvent,
      currentQuoteRes?.kind,
      quoteAction,
      quoteActionLock.quoteRequestId,
      setSettings,
      setSwapManualSelectQuoteProvider,
      setSwapQuoteEventTotalCount,
      setSwapQuoteList,
      swapEnableRecipientAddress,
      swapFromAddressInfo?.accountInfo?.account?.id,
      swapFromAddressInfo?.address,
      swapIncognitoMode,
      swapToAnotherAccountSwitchOn,
      swapToAddressInfo.address,
    ],
  );

  const onIncognitoModeChange = useCallback(
    (value: boolean) => {
      applyIncognitoModeChange(value);
    },
    [applyIncognitoModeChange],
  );

  const incognitoComponent = useMemo(
    () =>
      swapTypeSwitch === ESwapTabSwitchType.LIMIT ||
      swapTypeSwitch === ESwapTabSwitchType.STOCK ? null : (
        <XStack alignItems="center" gap="$2">
          <XStack alignItems="center" gap="$1.5">
            <Icon
              name="AnonymousHiddenOutline"
              size="$5"
              color="$iconSubdued"
            />
            {!platformEnv.isNative && gtMd ? (
              <Tooltip
                placement="top"
                hovering
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashThickness={0.5}
                    cursor="help"
                  >
                    {incognitoTitle}
                  </DashText>
                }
                renderContent={incognitoTooltipContent}
              />
            ) : (
              <Popover
                title={incognitoTitle}
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashThickness={0.5}
                    cursor="help"
                  >
                    {incognitoTitle}
                  </DashText>
                }
                renderContent={incognitoPopoverContent}
              />
            )}
          </XStack>
          <Stack ml={platformEnv.isNative ? '$-2' : undefined}>
            <Switch
              testID={SwapTestIDs.incognitoModeSwitch}
              size={ESwitchSize.extraSmall}
              value={swapIncognitoMode}
              onChange={onIncognitoModeChange}
            />
          </Stack>
        </XStack>
      ),
    [
      gtMd,
      incognitoPopoverContent,
      incognitoTooltipContent,
      incognitoTitle,
      onIncognitoModeChange,
      swapIncognitoMode,
      swapTypeSwitch,
    ],
  );

  const recipientAccountLabel = useMemo(() => {
    if (!swapRecipientAddressInfo?.showAddress) {
      return '';
    }

    if (swapRecipientAddressInfo?.isExtAccount) {
      return intl.formatMessage({
        id: ETranslations.swap_page_recipient_external_account,
      });
    }

    const rawRecipientAccountLabel = [
      swapRecipientAddressInfo?.accountInfo?.walletName,
      swapRecipientAddressInfo?.accountInfo?.accountName,
    ]
      .filter((item): item is string => Boolean(item))
      .join('-');

    if (!rawRecipientAccountLabel) {
      return '';
    }

    return rawRecipientAccountLabel;
  }, [
    intl,
    swapRecipientAddressInfo?.accountInfo?.accountName,
    swapRecipientAddressInfo?.accountInfo?.walletName,
    swapRecipientAddressInfo?.isExtAccount,
    swapRecipientAddressInfo?.showAddress,
  ]);

  const recipientSendToLabel = intl.formatMessage({
    id: ETranslations.swap_page_recipient_send_to,
  });

  const recipientAddLabel = intl.formatMessage({
    id: ETranslations.swap_page_recipient_add,
  });

  const recipientAddressDisplayLabel =
    swapRecipientAddressInfo?.showAddress ?? recipientAddLabel;

  const recipientAccountDisplayLabel =
    swapRecipientAddressInfo?.showAddress && recipientAccountLabel
      ? `(${recipientAccountLabel})`
      : null;

  const recipientAccountComponent = useMemo(
    () =>
      recipientAccountDisplayLabel ? (
        <XStack flexShrink={1} minWidth={0}>
          <SizableText
            testID="swap-recipient-account"
            flexShrink={1}
            minWidth={0}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {`(${recipientAccountLabel}`}
          </SizableText>
          <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
            )
          </SizableText>
        </XStack>
      ) : null,
    [recipientAccountDisplayLabel, recipientAccountLabel],
  );

  const recipientComponent = useMemo(() => {
    const recipientRow = (
      <XStack
        testID="swap-recipient-action-row"
        gap="$1.5"
        minWidth={0}
        {...(isDesktopModalPage ? { flex: 1 } : { pb: '$4' })}
      >
        <Stack>
          <Icon name="AddedPeopleOutline" size="$5" color="$iconSubdued" />
        </Stack>
        <XStack flex={1} gap="$1.5" minWidth={0}>
          <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
            {recipientSendToLabel}
          </SizableText>
          <SizableText
            flexShrink={0}
            size="$bodyMd"
            cursor="pointer"
            textDecorationLine="underline"
            onPress={onOpenRecipientAddress}
          >
            {recipientAddressDisplayLabel}
          </SizableText>
          {recipientAccountComponent}
        </XStack>
      </XStack>
    );
    if (isDesktopModalPage) {
      return shouldShowRecipientInActionRow ? recipientRow : null;
    }
    // OK-58977: provider support for a custom recipient varies per token, so
    // this row mounts/unmounts on token switches; reveal it smoothly. Its
    // spacing (pb) sits inside the measured content, so no gap offset needed.
    return (
      <SwapSmoothReveal
        visible={shouldShowRecipientInActionRow}
        snapshotKey={
          swapTypeSwitch === ESwapTabSwitchType.STOCK
            ? 'stock-recipient'
            : undefined
        }
        snapshotPending={
          swapEnableRecipientAddress && !stockRecipientSnapshotScope
        }
        snapshotScope={stockRecipientSnapshotScope}
      >
        {recipientRow}
      </SwapSmoothReveal>
    );
  }, [
    recipientAccountComponent,
    recipientAddressDisplayLabel,
    recipientSendToLabel,
    onOpenRecipientAddress,
    isDesktopModalPage,
    shouldShowRecipientInActionRow,
    swapTypeSwitch,
    swapEnableRecipientAddress,
    stockRecipientSnapshotScope,
  ]);

  const recipientFooterComponent = useMemo(() => {
    if (!isDesktopModalPage || !shouldShowRecipient) {
      return null;
    }

    return (
      <XStack
        gap="$1.5"
        flex={1}
        flexShrink={1}
        minWidth={0}
        alignItems="center"
        overflow="hidden"
      >
        <Stack flexShrink={0}>
          <Icon name="AddedPeopleOutline" size="$5" color="$iconSubdued" />
        </Stack>
        <XStack
          flex={1}
          minWidth={0}
          gap="$1.5"
          alignItems="center"
          overflow="hidden"
        >
          <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
            {recipientSendToLabel}
          </SizableText>
          <SizableText
            flexShrink={1}
            minWidth={0}
            size="$bodyMd"
            cursor="pointer"
            textDecorationLine="underline"
            onPress={onOpenRecipientAddress}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {recipientAddressDisplayLabel}
          </SizableText>
          {recipientAccountDisplayLabel ? (
            <SizableText
              flexShrink={1}
              minWidth={0}
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {recipientAccountDisplayLabel}
            </SizableText>
          ) : null}
        </XStack>
      </XStack>
    );
  }, [
    isDesktopModalPage,
    onOpenRecipientAddress,
    recipientAccountDisplayLabel,
    recipientAddressDisplayLabel,
    recipientSendToLabel,
    shouldShowRecipient,
  ]);

  const recipientMetaRowComponent = useMemo(() => {
    if (!shouldShowRecipientInMetaRow) {
      return null;
    }

    return (
      <XStack testID="swap-recipient-meta-row" flex={1} minWidth={0}>
        <XStack
          flex={1}
          minWidth={0}
          gap="$1.5"
          alignItems="center"
          justifyContent="flex-start"
          maxWidth="100%"
        >
          <Stack>
            <Icon name="AddedPeopleOutline" size="$5" color="$iconSubdued" />
          </Stack>
          <XStack
            flex={1}
            alignItems="center"
            justifyContent="flex-start"
            gap="$1.5"
            minWidth={0}
          >
            <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
              {recipientSendToLabel}
            </SizableText>
            <SizableText
              flexShrink={0}
              size="$bodyMd"
              cursor="pointer"
              textDecorationLine="underline"
              onPress={onOpenRecipientAddress}
            >
              {recipientAddressDisplayLabel}
            </SizableText>
            {recipientAccountComponent}
          </XStack>
        </XStack>
      </XStack>
    );
  }, [
    onOpenRecipientAddress,
    recipientAccountComponent,
    recipientAddressDisplayLabel,
    recipientSendToLabel,
    shouldShowRecipientInMetaRow,
  ]);

  const costSavingsComponent = useMemo(() => {
    const hasCostSavings =
      currentQuoteRes?.fee?.costSavings &&
      new BigNumber(currentQuoteRes?.fee?.costSavings || 0).gt(0);

    if (hasCostSavings) {
      const isLoadingQuote = quoteEventFetching || quoteLoading;
      const shouldShow = hasEverShownCostSavingsRef.current || !isLoadingQuote;

      if (shouldShow) {
        if (!hasEverShownCostSavingsRef.current) {
          hasEverShownCostSavingsRef.current = true;
        }

        const formattedFee = numberFormat(
          currentQuoteRes.fee?.costSavings ?? '0',
          {
            formatter: 'value',
            formatterOptions: {
              currency: settingsPersistAtom.currencyInfo.symbol,
            },
          },
        );

        return (
          <Badge
            badgeSize="sm"
            badgeType="success"
            alignSelf="center"
            gap="$1.5"
          >
            <Icon name="PartyCelebrateSolid" size="$3" color="$iconSuccess" />
            <SizableText size="$bodySmMedium" color="$textSuccess">
              {intl.formatMessage(
                { id: ETranslations.swap_fee_save },
                { fee: formattedFee },
              )}
            </SizableText>
          </Badge>
        );
      }
    } else {
      hasEverShownCostSavingsRef.current = false;
    }
    return null;
  }, [
    currentQuoteRes?.fee?.costSavings,
    settingsPersistAtom.currencyInfo.symbol,
    quoteEventFetching,
    quoteLoading,
    intl,
  ]);

  // OK-58846: reveal the fee-save badge smoothly instead of letting it shove
  // the surrounding layout; height is measured so localized or wrapped badge
  // content can never be clipped. parentGap offsets the hosting Stack gap
  // ("$2" = 8), which sits below the badge when it renders above the button.
  const costSavingsAboveButtonComponent = useMemo(
    () => (
      <SwapSmoothReveal
        visible={!!costSavingsComponent}
        parentGap={8}
        gapSide="bottom"
      >
        {costSavingsComponent}
      </SwapSmoothReveal>
    ),
    [costSavingsComponent],
  );

  const costSavingsBelowButtonComponent = useMemo(
    () => (
      <SwapSmoothReveal visible={!!costSavingsComponent} parentGap={8}>
        {costSavingsComponent}
      </SwapSmoothReveal>
    ),
    [costSavingsComponent],
  );

  useEffect(() => {
    if (!costSavingsComponent) {
      setDesktopActionWidth(undefined);
    }
  }, [costSavingsComponent]);

  const onDesktopActionTagLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = event?.nativeEvent?.layout?.width;

      if (typeof nextWidth !== 'number' || Number.isNaN(nextWidth)) {
        return;
      }

      setDesktopActionWidth((prevWidth) =>
        prevWidth === nextWidth ? prevWidth : nextWidth,
      );
    },
    [],
  );

  const actionLabel = noConnectWallet
    ? intl.formatMessage({ id: ETranslations.global_connect_wallet })
    : swapActionState.label;
  // The button shows either the quote dots or a label; each change rises in.
  const actionContentKey = shouldShowQuoteActionLoading ? null : actionLabel;
  const actionButtonRef = useActionContentMotion(
    actionContentKey,
    !!isActionDisabled,
  );
  const desktopActionButtonRef = useActionContentMotion(
    actionContentKey,
    !!isActionDisabled,
  );

  const actionButtonChildren = useMemo(
    () =>
      shouldShowQuoteActionLoading ? (
        <LottieView
          // The dots sit on the disabled fill, so each theme takes the file
          // drawn for the other theme's primary button: black dots in light,
          // white in dark.
          source={
            themeVariant === 'light'
              ? require('@onekeyhq/kit/assets/animations/swap_quote_loading_dark.json')
              : require('@onekeyhq/kit/assets/animations/swap_quote_loading_light.json')
          }
          autoPlay
          loop
          style={{
            width: 40,
            height: 24,
          }}
        />
      ) : (
        <SizableText
          flex={platformEnv.isNativeAndroid ? 1 : undefined}
          flexShrink={1}
          minWidth={0}
          maxWidth="100%"
          size="$bodyLgMedium"
          color={
            isActionDisabled ? BUTTON_DISABLED_COLORS.color : '$textInverse'
          }
          textAlign="center"
        >
          {actionLabel}
        </SizableText>
      ),
    [actionLabel, isActionDisabled, shouldShowQuoteActionLoading, themeVariant],
  );

  const actionRowComponent = useMemo(
    () => (
      <Stack
        flex={1}
        {...(isDesktopModalPage
          ? {
              flexDirection: 'row',
              justifyContent: shouldShowRecipientInActionRow
                ? 'space-between'
                : 'flex-end',
              alignItems: 'center',
            }
          : {})}
      >
        {recipientComponent}
        <Stack gap="$2">
          {/* In desktop modal: show savings above button; otherwise show below */}
          {isDesktopModalPage ? costSavingsAboveButtonComponent : null}
          <Button
            ref={actionButtonRef}
            testID={SwapTestIDs.swapButton}
            onPress={onActionHandlerBefore}
            size={isDesktopModalPage ? 'medium' : 'large'}
            variant="primary"
            disabled={isActionDisabled}
            {...(isActionDisabled && ACTION_BUTTON_DISABLED_STYLE)}
            borderRadius="$full"
            childrenAsText={false}
          >
            {actionButtonChildren}
          </Button>
          {/* In regular pages and non-desktop modal: show savings below button */}
          {!isDesktopModalPage ? costSavingsBelowButtonComponent : null}
        </Stack>
      </Stack>
    ),
    [
      onActionHandlerBefore,
      actionButtonChildren,
      actionButtonRef,
      isActionDisabled,
      isDesktopModalPage,
      recipientComponent,
      shouldShowRecipientInActionRow,
      costSavingsAboveButtonComponent,
      costSavingsBelowButtonComponent,
    ],
  );

  const actionComponent = useMemo(() => {
    let metaRow = incognitoComponent;

    if (showRecipientInMetaRow && incognitoComponent) {
      metaRow = isDesktopModalPage ? (
        <XStack gap="$6" alignItems="center" width="100%">
          {incognitoComponent}
          {recipientMetaRowComponent}
        </XStack>
      ) : (
        <XStack
          gap="$4"
          alignItems="center"
          justifyContent="space-between"
          width="100%"
        >
          {incognitoComponent}
          {recipientMetaRowComponent}
        </XStack>
      );
    }

    return (
      <Stack
        gap="$4"
        {...(showRecipientInMetaRow
          ? {
              flex: 1,
              width: '100%',
            }
          : {})}
      >
        {metaRow}
        {incognitoRecipientInputComponent}
        {actionRowComponent}
      </Stack>
    );
  }, [
    actionRowComponent,
    incognitoRecipientInputComponent,
    incognitoComponent,
    showRecipientInMetaRow,
    isDesktopModalPage,
    recipientMetaRowComponent,
  ]);

  const desktopModalRecipientSection = useMemo(() => {
    if (!incognitoComponent && !incognitoRecipientInputComponent) {
      return null;
    }

    return (
      <Stack gap="$4">
        {incognitoComponent}
        {incognitoRecipientInputComponent}
      </Stack>
    );
  }, [incognitoComponent, incognitoRecipientInputComponent]);

  const desktopFooterComponent = useMemo(
    () => (
      <Page.Footer>
        <Stack p="$5" bg="$bgApp" gap="$2">
          <SwapSmoothReveal
            visible={!!costSavingsComponent}
            parentGap={8}
            gapSide="bottom"
          >
            <XStack width="100%" justifyContent="flex-end">
              <Stack flexShrink={0} alignItems="stretch">
                <Stack alignItems="center" onLayout={onDesktopActionTagLayout}>
                  {costSavingsComponent}
                </Stack>
              </Stack>
            </XStack>
          </SwapSmoothReveal>
          <XStack width="100%" alignItems="center" gap="$4">
            <XStack
              flex={1}
              minWidth={0}
              gap="$6"
              alignItems="center"
              overflow="hidden"
            >
              {recipientFooterComponent}
            </XStack>
            <Stack
              flexShrink={0}
              alignItems="stretch"
              gap="$2"
              minWidth={desktopActionWidth}
            >
              <Button
                ref={desktopActionButtonRef}
                testID={SwapTestIDs.actionPrimaryButton}
                onPress={onActionHandlerBefore}
                size="medium"
                variant="primary"
                disabled={isActionDisabled}
                {...(isActionDisabled && ACTION_BUTTON_DISABLED_STYLE)}
                borderRadius="$full"
                childrenAsText={false}
              >
                {actionButtonChildren}
              </Button>
            </Stack>
          </XStack>
        </Stack>
        {!platformEnv.isNativeIOS ? (
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        ) : null}
      </Page.Footer>
    ),
    [
      actionButtonChildren,
      costSavingsComponent,
      desktopActionButtonRef,
      desktopActionWidth,
      isActionDisabled,
      onActionHandlerBefore,
      onDesktopActionTagLayout,
      onSelectPercentageStage,
      recipientFooterComponent,
    ],
  );

  const actionComponentCoverFooter = useMemo(
    () => (
      <>
        {actionComponent}
        {!platformEnv.isNativeIOS ? (
          <Page.Footer>
            <PercentageStageOnKeyboard
              onSelectPercentageStage={onSelectPercentageStage}
            />
          </Page.Footer>
        ) : null}
      </>
    ),
    [actionComponent, onSelectPercentageStage],
  );

  return (
    <>
      {isDesktopModalPage ? (
        <>
          {desktopModalRecipientSection}
          {desktopFooterComponent}
        </>
      ) : (
        actionComponentCoverFooter
      )}
    </>
  );
};

export default memo(SwapActionsState);
