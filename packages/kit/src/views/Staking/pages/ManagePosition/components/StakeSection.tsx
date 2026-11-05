import type { ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import {
  buildAaveNativeGatewayReceiveToken,
  isUnsupportedAaveNativeReserve,
  resolveBorrowTokenApproveSpenderAddress,
  shouldUseAaveNativeGateway,
} from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import {
  type IManagePositionConfirmParams,
  ManagePosition,
} from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import { buildBorrowTokenApproveTarget } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/borrowApproval.utils';
import {
  useUniversalBorrowBorrow,
  useUniversalBorrowSupply,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopPressable';
import {
  readPayWithPickerAccountAddress,
  readPayWithPickerNetwork,
  warmPayWithPickerTokens,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnPayWithPickerData';
import {
  findOffer,
  findPayToken,
  getPayTokenAddress,
  pickDefaultPayTokenAcrossNetworks,
  resolvePayMode,
  toPayTokenSwapToken,
  toPickedPayToken,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnRouter.utils';
import { useEarnRouterOffers } from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/EarnRouterOffer';
import {
  PAY_WITH_TRIGGER_TEST_ID,
  refreshPickedPayToken,
  rememberPickedPayToken,
  usePayTokens,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/EarnRouterPayWith';
import { EarnRouterSwapDepositForm } from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/EarnRouterSwapDepositForm';
import type { IEarnRouterSummaryRequest } from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/EarnRouterSwapDepositForm';
import {
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import {
  EApproveType,
  ECheckAmountActionType,
  EEarnLabels,
} from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnAssetsList,
  IEarnSelectField,
  IEarnTokenInfo,
  IEarnTokenItem,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnRiskWarningGate } from '../../../components/EarnRiskWarningDialog';
import { EarnBalanceNoteContext } from '../../../components/StakingAmountInput';
import {
  ProtocolSwitcher,
  UniversalStake,
} from '../../../components/UniversalStake';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { easeModalHeightChanges } from '../../../hooks/useFitModalHeight';
import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useUniversalStake } from '../../../hooks/useUniversalHooks';
import { preloadEarnPayWithTokenSelect } from '../../../router';
import {
  buildBorrowTag,
  buildStakeTokenUniqueKey,
  normalizeStakeTokenAddress,
  resolveNativeEarnProtocolSymbol,
  resolveNativeEarnStakeRequestSymbol,
  resolveNativeEarnStakeType,
  resolveStakeTokenAddress,
} from '../../../utils/utils';

import { resolveStakeInitialAllowanceTarget } from './StakeSection.utils';

import type {
  IManagePositionFooterAction,
  IManagePositionPayWith,
  IManagePositionProtocolSwitchConfig,
} from './ManagePositionContent';
import type { IWithdrawSuccessInfo } from './WithdrawSection';
import type { IManagePageV2ReceiveInputConfig } from '../../../components/ManagePageV2ReceiveInput';
import type { IEarnConfirmWordId } from '../../../components/UniversalStake/earnConfirmWord';

export const StakeSection = ({
  accountId,
  networkId,
  tokenInfo,
  protocolInfo,
  isDisabled,
  onSuccess,
  beforeFooter,
  footerActionOverride,
  confirmWordIdWhileLoading,
  showApyDetail,
  suppressPlatformBonus,
  isInModalContext,
  fallbackTokenImageUri,
  protocolSwitchConfig,
  payWith,
  initialAmount,
  offerSwitch,
  onAmountChange,
  ongoingValidator,
  useBorrowApi,
  borrowMarketAddress,
  borrowReserveAddress,
  borrowAction,
  borrowActionLabel,
  receiveInputConfig,
  pendleSlippage,
  isQuoteExpired,
  onQuoteReset,
  refreshKey,
  onQuoteRefreshingChange,
  onRefreshTokenInfo,
}: {
  accountId: string;
  networkId: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  isDisabled?: boolean;
  // What went in, for the deposit modal's done view
  onSuccess?: (info?: IWithdrawSuccessInfo) => void;
  beforeFooter?: ReactElement | null;
  footerActionOverride?: IManagePositionFooterAction;
  // The word the deposit button showed last time, for the form standing in
  // before the protocol is in
  confirmWordIdWhileLoading?: IEarnConfirmWordId;
  showApyDetail?: boolean;
  suppressPlatformBonus?: boolean;
  isInModalContext?: boolean;
  fallbackTokenImageUri?: string;
  protocolSwitchConfig?: IManagePositionProtocolSwitchConfig;
  payWith?: IManagePositionPayWith;
  initialAmount?: string;
  // The caller's own protocol selector (the Earn deposit modal's offers),
  // drawn where the form's protocol switcher goes
  offerSwitch?: ReactNode;
  // What is typed, so a caller that starts the form over can carry it
  onAmountChange?: (amount: string) => void;
  ongoingValidator?: IEarnSelectField;
  useBorrowApi?: boolean;
  borrowMarketAddress?: string;
  borrowReserveAddress?: string;
  borrowAction?: 'supply' | 'withdraw' | 'borrow' | 'repay';
  borrowActionLabel?: string;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  pendleSlippage?: number;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
  // Asks the page for the token's balance again, as a swap brought some in
  onRefreshTokenInfo?: () => void;
}) => {
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const intl = useIntl();
  const navigation = useAppNavigation();
  const hasRequiredData = tokenInfo && protocolInfo;
  const providerName = useMemo(
    () => protocolInfo?.provider ?? '',
    [protocolInfo?.provider],
  );
  const isPendleProvider = useIsPendleProvider(providerName);
  const isNativeProvider = useMemo(
    () => earnUtils.isNativeProvider({ providerName }),
    [providerName],
  );
  const borrowProviderDisplayName = useMemo(() => {
    if (
      protocolInfo?.providerDetail.name &&
      protocolInfo.providerDetail.name !== providerName
    ) {
      return protocolInfo.providerDetail.name;
    }
    return earnUtils.getEarnProviderName({
      providerName,
    });
  }, [protocolInfo?.providerDetail.name, providerName]);
  // The token Pendle's form last bought with, or picked in its own list
  const [stakeAssetChoice, setStakeAssetChoice] = useState<
    IEarnTokenItem | undefined
  >(undefined);
  const stakeAssetsSymbol = useMemo(
    () =>
      resolveNativeEarnProtocolSymbol({
        isNativeProvider,
        protocolSymbol: protocolInfo?.symbol,
      }),
    [isNativeProvider, protocolInfo?.symbol],
  );
  const borrowApiCtx = useBorrowApiParams({
    useBorrowApi,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    accountId,
    action: borrowAction,
  });
  const isBorrowStake =
    borrowApiCtx.isBorrow &&
    (borrowApiCtx.borrowApiParams.action === 'supply' ||
      borrowApiCtx.borrowApiParams.action === 'borrow');
  const borrowDelegationApproveTarget = useMemo(() => {
    if (
      !borrowApiCtx.isBorrow ||
      borrowApiCtx.borrowApiParams.action !== 'borrow' ||
      protocolInfo?.borrowAllowance === undefined
    ) {
      return undefined;
    }

    const { provider, marketAddress, reserveAddress } =
      borrowApiCtx.borrowApiParams;
    return {
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      allowance: protocolInfo.borrowAllowance,
    };
  }, [accountId, borrowApiCtx, networkId, protocolInfo?.borrowAllowance]);

  // The tokens Pendle's and a native provider's forms take, read once the
  // form's data is in
  const needsStakeAssets =
    hasRequiredData &&
    (isPendleProvider || isNativeProvider) &&
    Boolean(accountId) &&
    Boolean(stakeAssetsSymbol);
  const { result: stakeAssetsList } = usePromiseResult(
    async (): Promise<IEarnAssetsList | undefined> => {
      if (
        !hasRequiredData ||
        !(isPendleProvider || isNativeProvider) ||
        !accountId ||
        !stakeAssetsSymbol
      ) {
        return undefined;
      }
      try {
        return await backgroundApiProxy.serviceStaking.getEarnAssetsList({
          accountId,
          networkId,
          provider: providerName,
          symbol: stakeAssetsSymbol,
          vault: protocolInfo?.vault || undefined,
          action: 'stake',
        });
      } catch {
        // Without the list the form starts on its own token
        return { assets: [] };
      }
    },
    [
      hasRequiredData,
      isPendleProvider,
      isNativeProvider,
      accountId,
      networkId,
      providerName,
      protocolInfo?.vault,
      stakeAssetsSymbol,
    ],
    {
      watchLoading: true,
    },
  );

  const selectableStakeAssets = useMemo(() => {
    return stakeAssetsList?.assets ?? [];
  }, [stakeAssetsList?.assets]);

  // Pay with, for deposits and supplies (not borrowing)
  const canPayWith =
    Boolean(payWith) &&
    !(
      borrowApiCtx.isBorrow && borrowApiCtx.borrowApiParams.action === 'borrow'
    );
  // Pay with's picker read ahead while the form shows (its code, the
  // network, the wallet's address there and the network's tokens), so its
  // first open is complete. The currency and the DeFi tokens switch as the
  // form opens: the switch changing in the picker is the picker's to read
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [{ swapShowLpTokensOnly }] = useTokenSelectorFilterPersistAtom();
  const { gtMd } = useMedia();
  const pickerPrefsRef = useRef({
    currencyId: currencyInfo.id,
    showLpTokensOnly: swapShowLpTokensOnly,
    // The picker's own test for its two-column layout
    isWide: Boolean((platformEnv.isDesktop || platformEnv.isWeb) && gtMd),
  });
  // The page's token: Pendle's form token is the one its buy side starts on
  // (USDC for PT-sUSD3), which isn't the token the page is for
  const depositSymbol = protocolInfo?.symbol || tokenInfo?.token.symbol || '';
  // The amount box says what it takes (what the user pays with, when Pay with
  // is on), so the action's name stays on the tab and the button
  const payInputTitle = canPayWith
    ? EARN_DESKTOP_DEMO_COPY.payWith
    : intl.formatMessage({ id: ETranslations.content__amount });
  // The Earn window's Pay with lists every network's tokens (11-05)
  const isPayAcrossNetworks = canPayWith && Boolean(payWith?.acrossNetworks);
  const pay = usePayTokens({
    accountId,
    networkId,
    depositSymbol,
    enabled: canPayWith && Boolean(depositSymbol),
    acrossNetworks: isPayAcrossNetworks,
  });
  // An account with nothing at all on this network: Pay with's balance says
  // so and names the network, where a 0 would speak of one token only. The
  // form stays open; an amount typed gets the usual message (demo 10-30)
  const { result: payNetwork } = usePromiseResult(
    async () =>
      canPayWith
        ? backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId })
        : undefined,
    [canPayWith, networkId],
  );
  const payBalanceNote =
    canPayWith &&
    !isPayAcrossNetworks &&
    accountId &&
    pay.isNetworkEmpty &&
    payNetwork?.name
      ? EARN_DESKTOP_DEMO_COPY.noFundsOnNetwork(payNetwork.name)
      : undefined;
  // Pay with's own tokens by address, which the picker lists also where
  // Swap files them under DeFi tokens. Joined, so a balance refresh that
  // keeps the same tokens changes nothing
  const payTokenAddressesKey = useMemo(
    () => pay.heldTokens.map(getPayTokenAddress).filter(Boolean).join(','),
    [pay.heldTokens],
  );
  useEffect(() => {
    if (!canPayWith) {
      return;
    }
    void preloadEarnPayWithTokenSelect();
    void readPayWithPickerNetwork(networkId);
    void readPayWithPickerAccountAddress({ accountId, networkId });
    void warmPayWithPickerTokens({
      accountId,
      networkId,
      ...pickerPrefsRef.current,
      payTokenAddresses: payTokenAddressesKey
        ? payTokenAddressesKey.split(',')
        : [],
    });
  }, [accountId, canPayWith, networkId, payTokenAddressesKey]);
  // The start amount goes to the first form shown. One opened by picking
  // another token in Pay with starts empty, as before
  const [startAmount, setStartAmount] = useState(initialAmount);
  // Under the deposit modal's protocol switcher, another protocol remounts
  // the input below; it starts from what was typed, so the amount stays put
  const typedAmountRef = useRef(initialAmount);
  const handleAmountChange = useCallback(
    (value: string) => {
      typedAmountRef.current = value;
      onAmountChange?.(value);
    },
    [onAmountChange],
  );
  const inputStartAmount = offerSwitch ? typedAmountRef.current : startAmount;
  const [ownPayKey, setOwnPayKey] = useState<string>();
  const payKey = payWith?.onSelectedKeyChange ? payWith.selectedKey : ownPayKey;
  const setPayKey = payWith?.onSelectedKeyChange ?? setOwnPayKey;
  const payToken = useMemo(() => {
    if (!canPayWith) {
      return undefined;
    }
    const picked = findPayToken(pay.tokens, payKey);
    if (picked) {
      return picked;
    }
    // Comparing a kind: the token Pay with stays on. Across networks, where
    // the wallet holds most of it, as a token's own default is (11-05)
    const preferSymbol = payWith?.preferSymbol?.toLowerCase();
    const preferred = preferSymbol
      ? pay.heldTokens.find(
          (item) => item.token.symbol.toLowerCase() === preferSymbol,
        )
      : undefined;
    if (preferred && isPayAcrossNetworks && preferSymbol) {
      return (
        pickDefaultPayTokenAcrossNetworks(
          pay.heldTokens.filter(
            (item) => item.token.symbol.toLowerCase() === preferSymbol,
          ),
          preferSymbol,
        ) ?? preferred
      );
    }
    if (preferred) {
      return preferred;
    }
    if (!payWith?.preferDepositToken) {
      return pay.defaultToken;
    }
    // The deposit's own token; across networks, else the same token where
    // the wallet holds most of it (the list's next), bridged over
    const depositKey = depositSymbol.toLowerCase();
    return (
      pay.heldTokens.find((item) => item.isDepositToken) ??
      (isPayAcrossNetworks && depositKey
        ? pay.heldTokens.find(
            (item) => item.token.symbol.toLowerCase() === depositKey,
          )
        : undefined)
    );
  }, [
    canPayWith,
    depositSymbol,
    isPayAcrossNetworks,
    pay.defaultToken,
    pay.heldTokens,
    pay.tokens,
    payKey,
    payWith?.preferDepositToken,
    payWith?.preferSymbol,
  ]);
  // Told to the deposit modal, which marks the protocols a swap comes before
  const onPayTokenChange = payWith?.onTokenChange;
  const payTokenSymbol = payToken?.token.symbol;
  const payTokenNetworkId = payToken?.networkId || networkId;
  const isPayTokenPicked = Boolean(findPayToken(pay.tokens, payKey));
  useEffect(() => {
    onPayTokenChange?.(
      payTokenSymbol
        ? {
            symbol: payTokenSymbol,
            networkId: payTokenNetworkId,
            isPicked: isPayTokenPicked,
          }
        : undefined,
    );
  }, [isPayTokenPicked, onPayTokenChange, payTokenNetworkId, payTokenSymbol]);
  // After a swap paid for the deposit: the deposit form takes over on the
  // tokens it brought in, filled with them and pressed once by itself, as
  // the swap's press asked. Only for the provider the swap was for; picking
  // another token in Pay with ends it
  const handoffTarget = `${providerName}|${protocolInfo?.vault ?? ''}`;
  const [handoff, setHandoff] = useState<{
    amount: string;
    balance?: string;
    target: string;
    autoSubmitKey?: number;
  }>();
  useEffect(() => {
    setHandoff((prev) =>
      prev?.autoSubmitKey !== undefined && prev.target !== handoffTarget
        ? { ...prev, autoSubmitKey: undefined }
        : prev,
    );
  }, [handoffTarget]);
  const handleAutoSubmit = useCallback(() => {
    setHandoff((prev) => (prev ? { ...prev, autoSubmitKey: undefined } : prev));
  }, []);
  // What a swap buys: the provider form's own token. Pendle's is its buy
  // side's (USDC for PT-sUSDe), not the page's, so the swap path names it by
  // itself and the hand-off pays with it
  const swapTokenAddress = tokenInfo?.token
    ? normalizeStakeTokenAddress({
        address: tokenInfo.token.address,
        isNative: tokenInfo.token.isNative,
      })
    : undefined;
  // Pay with moves to the token the swap brought once the wallet lists it
  const handoffPayKey = pay.heldTokens.find((item) =>
    isPendleProvider
      ? getPayTokenAddress(item) === swapTokenAddress
      : item.isDepositToken,
  )?.key;
  useEffect(() => {
    if (handoff && handoffPayKey && payKey !== handoffPayKey) {
      setPayKey(handoffPayKey);
    }
  }, [handoff, handoffPayKey, payKey, setPayKey]);
  // Pay with's picker: Swap's, kept to this network, in a modal over the
  // form. Picking another token starts the amount over, as an amount of the
  // last token means nothing in this one
  const handlePickPayToken = useCallback(
    (token: ISwapToken) => {
      const depositToken =
        tokenInfo?.token &&
        tokenInfo.token.symbol.toLowerCase() === depositSymbol.toLowerCase()
          ? tokenInfo.token
          : undefined;
      // A pick on another network pays from the wallet's account there
      const pickNetworkId = token.networkId || networkId;
      const item = toPickedPayToken({
        token,
        tokens: pay.heldTokens,
        depositToken,
        depositSymbol,
        depositNetworkId: isPayAcrossNetworks ? networkId : undefined,
        accountId:
          pickNetworkId === networkId
            ? accountId
            : pay.heldTokens.find(
                (held) => held.networkId === pickNetworkId && held.accountId,
              )?.accountId,
      });
      if (!pay.heldTokens.some((held) => held.key === item.key)) {
        rememberPickedPayToken(pickNetworkId, item);
        void refreshPickedPayToken({
          accountId: item.accountId || accountId,
          networkId: pickNetworkId,
          item,
        });
      }
      if (item.key === payToken?.key) {
        return;
      }
      // The form is built again for the new token (another path, its own
      // rows): the modal's height eases through it, as for another protocol
      easeModalHeightChanges();
      setStartAmount(undefined);
      typedAmountRef.current = undefined;
      onAmountChange?.('');
      setHandoff(undefined);
      setPayKey(item.key);
    },
    [
      accountId,
      depositSymbol,
      isPayAcrossNetworks,
      networkId,
      onAmountChange,
      pay.heldTokens,
      payToken?.key,
      setPayKey,
      tokenInfo?.token,
    ],
  );
  const pickerHeight = payWith?.pickerHeight;
  const handleOpenPayWith = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnPayWithTokenSelect,
      params: {
        accountId,
        networkId,
        payTokenAddresses: payTokenAddressesKey
          ? payTokenAddressesKey.split(',')
          : [],
        modalHeight: pickerHeight,
        selectedToken: payToken
          ? {
              address: payToken.token.address,
              isNative: Boolean(payToken.token.isNative),
              networkId: payToken.networkId || networkId,
            }
          : undefined,
        acrossNetworks: isPayAcrossNetworks,
        ...(isPayAcrossNetworks
          ? {
              heldTokens: pay.heldTokens.map(toPayTokenSwapToken),
              accountIdByNetwork: Object.fromEntries(
                pay.heldTokens.flatMap((item) =>
                  item.accountId ? [[item.networkId, item.accountId]] : [],
                ),
              ),
            }
          : {}),
        onSelect: handlePickPayToken,
      },
    });
  }, [
    accountId,
    handlePickPayToken,
    isPayAcrossNetworks,
    navigation,
    networkId,
    pay.heldTokens,
    payToken,
    payTokenAddressesKey,
    pickerHeight,
  ]);
  // Laid over each form's own token chip
  const payWithTrigger = useMemo(
    () => ({ testID: PAY_WITH_TRIGGER_TEST_ID }),
    [],
  );
  const payMode = handoff
    ? 'direct'
    : resolvePayMode({
        payToken,
        takesOtherTokens: isPendleProvider || isNativeProvider,
        zapInputs: selectableStakeAssets.map((asset) => ({
          address: asset.info.address,
          isNative: asset.info.isNative,
        })),
        depositNetworkId: isPayAcrossNetworks ? networkId : undefined,
      });
  // A swap first, or a bridge (a swap on the way where it's another token):
  // both are the swap path's form
  const isSwapPath =
    payMode === 'swapThenDeposit' || payMode === 'bridgeThenDeposit';
  // The form shown before this one: paying with another token brings the
  // swap form's line under the box (it grows in), and paying with the token
  // itself again takes it away (its room closes); the same form drawn again
  // for another protocol keeps it as it was. Pendle's own form has the line
  // too ("You receive"), so between its two forms the line stays
  const lastPayModeRef = useRef(payMode);
  const wasSwapPath =
    lastPayModeRef.current === 'swapThenDeposit' ||
    lastPayModeRef.current === 'bridgeThenDeposit';
  const revealsDepositLine = !isPendleProvider && isSwapPath && !wasSwapPath;
  const collapsesDepositLine = !isPendleProvider && !isSwapPath && wasSwapPath;
  useEffect(() => {
    lastPayModeRef.current = payMode;
  }, [payMode]);
  const { refresh: refreshPayTokens } = pay;
  // Swap's refresh beside a zero balance: the page's balance and Pay with's
  // list, for a token that just came in
  const handleRefreshPayBalance = useCallback(() => {
    onRefreshTokenInfo?.();
    return refreshPayTokens();
  }, [onRefreshTokenInfo, refreshPayTokens]);
  const handleSwapped = useCallback(
    ({ amount, balance }: { amount: string; balance?: string }) => {
      setStartAmount(amount);
      typedAmountRef.current = amount;
      onAmountChange?.(amount);
      setHandoff({
        amount,
        balance,
        target: handoffTarget,
        autoSubmitKey: amount ? Date.now() : undefined,
      });
      // The page's balance and Pay with's list, as the swap moved both; a
      // bridge moved its own network's too
      onRefreshTokenInfo?.();
      void refreshPayTokens(
        payTokenNetworkId === networkId ? undefined : [payTokenNetworkId],
      );
    },
    [
      handoffTarget,
      networkId,
      onAmountChange,
      onRefreshTokenInfo,
      payTokenNetworkId,
      refreshPayTokens,
    ],
  );
  // The rate the swap path estimates with: this provider's among the
  // token's offers on the network
  const { offers: payOffers } = useEarnRouterOffers({
    symbol: depositSymbol,
    networkId,
    enabled: isSwapPath,
  });
  const payOfferApr = useMemo(
    () =>
      findOffer({
        offers: payOffers,
        provider: providerName,
        vault: protocolInfo?.vault || undefined,
        marketAddress: borrowMarketAddress,
      })?.apr,
    [borrowMarketAddress, payOffers, protocolInfo?.vault, providerName],
  );

  // The token Pendle's form buys with: Pay with's, and after a swap the
  // token the swap brought, before the wallet's list shows it
  const payWithAddress =
    handoff && isPendleProvider
      ? swapTokenAddress
      : payToken &&
        normalizeStakeTokenAddress({
          address: payToken.token.address,
          isNative: payToken.token.isNative,
        });
  // The token Pendle's form buys with, worked out as the form renders, so
  // it is never drawn on another token first (the list's first, before the
  // wallet is read) and drawn again: Pay with's token when the list takes
  // it, else the one before, else the list's first
  const selectedStakeAsset = useMemo(() => {
    if (!selectableStakeAssets.length) {
      return undefined;
    }
    if (payWithAddress !== undefined) {
      const picked = selectableStakeAssets.find(
        (asset) =>
          normalizeStakeTokenAddress({
            address: asset.info.address,
            isNative: asset.info.isNative,
          }) === payWithAddress,
      );
      if (picked) {
        return picked;
      }
    }
    if (stakeAssetChoice) {
      const prevAddress = normalizeStakeTokenAddress({
        address: stakeAssetChoice.info.address,
        isNative: stakeAssetChoice.info.isNative,
      });
      const matchedPrev = selectableStakeAssets.find((asset) => {
        const assetAddress = normalizeStakeTokenAddress({
          address: asset.info.address,
          isNative: asset.info.isNative,
        });
        return (
          assetAddress === prevAddress &&
          asset.info.symbol.toLowerCase() ===
            stakeAssetChoice.info.symbol.toLowerCase()
        );
      });
      if (matchedPrev) {
        return matchedPrev;
      }
    }
    return selectableStakeAssets[0];
  }, [payWithAddress, selectableStakeAssets, stakeAssetChoice]);
  useEffect(() => {
    setStakeAssetChoice(selectedStakeAsset);
  }, [selectedStakeAsset]);

  const effectiveStakeTokenInfo = useMemo(() => {
    if (!tokenInfo || !selectedStakeAsset) {
      return tokenInfo;
    }
    return {
      ...tokenInfo,
      balanceParsed: selectedStakeAsset.balanceParsed || '0',
      price: selectedStakeAsset.price || '0',
      token: {
        ...tokenInfo.token,
        ...selectedStakeAsset.info,
      } as IEarnTokenInfo['token'],
    };
  }, [selectedStakeAsset, tokenInfo]);

  const selectedStakeTokenAddress = useMemo(
    () =>
      resolveStakeTokenAddress({
        address: effectiveStakeTokenInfo?.token.address,
        isNative: effectiveStakeTokenInfo?.token.isNative,
      }),
    [
      effectiveStakeTokenInfo?.token.address,
      effectiveStakeTokenInfo?.token.isNative,
    ],
  );
  const nativeWrappedStakeAsset = useMemo(() => {
    if (!isNativeProvider) {
      return undefined;
    }
    return selectableStakeAssets.find(
      (asset) =>
        !asset.info.isNative && asset.info.symbol.toUpperCase() === 'WETH',
    );
  }, [isNativeProvider, selectableStakeAssets]);
  const nativeStakeType = useMemo(
    () =>
      resolveNativeEarnStakeType({
        isNativeProvider,
        vaultSymbol: stakeAssetsSymbol,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      isNativeProvider,
      stakeAssetsSymbol,
    ],
  );
  const stakeRequestSymbol = useMemo(
    () =>
      resolveNativeEarnStakeRequestSymbol({
        isNativeProvider,
        protocolSymbol: stakeAssetsSymbol || protocolInfo?.symbol,
        tokenSymbol:
          effectiveStakeTokenInfo?.token.symbol || tokenInfo?.token.symbol,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
        wrappedTokenSymbol: nativeWrappedStakeAsset?.info.symbol,
      }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      effectiveStakeTokenInfo?.token.symbol,
      isNativeProvider,
      nativeWrappedStakeAsset?.info.symbol,
      protocolInfo?.symbol,
      stakeAssetsSymbol,
      tokenInfo?.token.symbol,
    ],
  );
  // On the swap path, what this provider's own form asks for its card, so
  // the path shows that card for what reaches the provider
  const paySummaryRequest = useMemo<
    IEarnRouterSummaryRequest | undefined
  >(() => {
    if (!isSwapPath) {
      return undefined;
    }
    if (isBorrowStake) {
      const { provider, marketAddress, reserveAddress } =
        borrowApiCtx.borrowApiParams;
      return {
        kind: 'lending',
        provider,
        marketAddress,
        reserveAddress,
        accountId,
      };
    }
    if (!protocolInfo?.provider) {
      return undefined;
    }
    const request = {
      provider: protocolInfo.provider,
      symbol: stakeRequestSymbol || effectiveStakeTokenInfo?.token.symbol || '',
      vault: earnUtils.shouldSendEarnProtocolVault({
        providerName: protocolInfo.provider,
      })
        ? protocolInfo.vault || ''
        : '',
      accountAddress: protocolInfo.earnAccount?.accountAddress || '',
    };
    if (isPendleProvider) {
      // Pendle's buy with the token the swap brings, quoted as its own form
      // quotes a buy
      if (!tokenInfo?.token || !receiveInputConfig?.tokenAddress) {
        return undefined;
      }
      return {
        kind: 'pendle',
        ...request,
        inputTokenAddress: resolveStakeTokenAddress({
          address: tokenInfo.token.address,
          isNative: tokenInfo.token.isNative,
        }),
        outputTokenAddress: receiveInputConfig.tokenAddress,
        receiveSymbol: receiveInputConfig.tokenSymbol ?? '',
        slippage: pendleSlippage,
      };
    }
    return {
      kind: 'staking',
      ...request,
      inputTokenAddress: selectedStakeTokenAddress,
      outputTokenAddress: receiveInputConfig?.tokenAddress ?? '',
    };
  }, [
    accountId,
    borrowApiCtx.borrowApiParams,
    effectiveStakeTokenInfo?.token.symbol,
    isBorrowStake,
    isPendleProvider,
    isSwapPath,
    pendleSlippage,
    protocolInfo?.earnAccount?.accountAddress,
    protocolInfo?.provider,
    protocolInfo?.vault,
    receiveInputConfig?.tokenAddress,
    receiveInputConfig?.tokenSymbol,
    selectedStakeTokenAddress,
    stakeRequestSymbol,
    tokenInfo?.token,
  ]);
  const approveSpenderAddress = useMemo(() => {
    if (borrowApiCtx.isBorrow) {
      return resolveBorrowTokenApproveSpenderAddress({
        providerName: protocolInfo?.provider,
        marketAddress: borrowApiCtx.borrowApiParams.marketAddress,
        backendApproveTarget: protocolInfo?.approve?.approveTarget,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      });
    }

    return earnUtils.resolveEarnApproveSpenderAddress({
      providerName: protocolInfo?.provider || '',
      protocolVault: protocolInfo?.vault,
      backendApproveTarget: protocolInfo?.approve?.approveTarget,
    });
  }, [
    borrowApiCtx,
    effectiveStakeTokenInfo?.token?.isNative,
    protocolInfo?.provider,
    protocolInfo?.vault,
    protocolInfo?.approve?.approveTarget,
  ]);
  const effectiveApproveType = useMemo(() => {
    return earnUtils.resolveEarnApproveType({
      providerName: protocolInfo?.provider || '',
      networkId,
      tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      approveSpenderAddress,
      backendApproveType: protocolInfo?.approve?.approveType,
    });
  }, [
    protocolInfo?.provider,
    protocolInfo?.approve?.approveType,
    effectiveStakeTokenInfo?.token?.isNative,
    approveSpenderAddress,
    networkId,
  ]);

  const selectedStakeTokenUniqueKey = useMemo(() => {
    if (selectedStakeAsset?.info) {
      return buildStakeTokenUniqueKey({
        uniqueKey: selectedStakeAsset.info.uniqueKey,
        address: selectedStakeAsset.info.address,
        symbol: selectedStakeAsset.info.symbol,
        isNative: selectedStakeAsset.info.isNative,
      });
    }
    return buildStakeTokenUniqueKey({
      uniqueKey: effectiveStakeTokenInfo?.token.uniqueKey,
      address: effectiveStakeTokenInfo?.token.address,
      symbol: effectiveStakeTokenInfo?.token.symbol,
      isNative: effectiveStakeTokenInfo?.token.isNative,
    });
  }, [selectedStakeAsset?.info, effectiveStakeTokenInfo?.token]);

  const handleOpenStakeTokenSelector = useCallback(() => {
    if (!accountId || !stakeAssetsSymbol) return;
    const currentAddress = selectedStakeAsset?.info?.isNative
      ? 'native'
      : selectedStakeAsset?.info?.address;
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnTokenSelect,
      params: {
        networkId,
        accountId,
        provider: providerName,
        symbol: stakeAssetsSymbol,
        vault: protocolInfo?.vault || undefined,
        action: 'stake' as const,
        currentTokenAddress: currentAddress,
        onSelect: (item: IEarnTokenItem) => {
          setStakeAssetChoice(item);
        },
      },
    });
  }, [
    accountId,
    networkId,
    providerName,
    protocolInfo?.vault,
    selectedStakeAsset?.info,
    navigation,
    stakeAssetsSymbol,
  ]);

  const stakeTokenSelectorTriggerProps = useMemo(() => {
    if (canPayWith) {
      // Pay with's picker opens from the keyboard too
      return {
        disabled: false,
        onPress: handleOpenPayWith,
        ...buildKeyboardPressProps(handleOpenPayWith),
        ...payWithTrigger,
      };
    }
    if (
      !(isPendleProvider || isNativeProvider) ||
      !selectableStakeAssets.length
    ) {
      return undefined;
    }

    return {
      disabled: selectableStakeAssets.length <= 1,
      onPress:
        selectableStakeAssets.length > 1
          ? handleOpenStakeTokenSelector
          : undefined,
    };
  }, [
    canPayWith,
    handleOpenPayWith,
    payWithTrigger,
    isPendleProvider,
    isNativeProvider,
    selectableStakeAssets.length,
    handleOpenStakeTokenSelector,
  ]);

  const { result: estimateFeeUTXO } = usePromiseResult(async () => {
    if (!hasRequiredData || !networkUtils.isBTCNetwork(networkId)) {
      return;
    }
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const accountAddress = account.address;
    const result = await backgroundApiProxy.serviceGas.estimateFee({
      accountId,
      networkId,
      accountAddress,
    });
    return result.feeUTXO?.filter(
      (o): o is Required<Pick<IFeeUTXO, 'feeRate'>> => o.feeRate !== undefined,
    );
  }, [accountId, networkId, hasRequiredData]);

  const [btcFeeRate, setBtcFeeRate] = useState<string | undefined>();
  const btcFeeRateInit = useRef<boolean>(false);
  const { removePermitCache } = useEarnActions().current;

  const onFeeRateChange = useMemo(() => {
    if (
      protocolInfo?.provider.toLowerCase() ===
      EEarnProviderEnum.Babylon.toLowerCase()
    ) {
      return (value: string) => setBtcFeeRate(value);
    }
  }, [protocolInfo?.provider]);

  useEffect(() => {
    if (
      estimateFeeUTXO &&
      estimateFeeUTXO.length === 3 &&
      !btcFeeRateInit.current
    ) {
      const [, normalFee] = estimateFeeUTXO;
      setBtcFeeRate(normalFee.feeRate);
      btcFeeRateInit.current = true;
    }
  }, [estimateFeeUTXO]);

  const borrowSupplyApproveToken = useMemo<IToken | undefined>(() => {
    const token = tokenInfo?.token as IToken | undefined;
    if (!token) {
      return undefined;
    }
    if (protocolInfo?.approveAsset) {
      return {
        ...token,
        address: protocolInfo.approveAsset,
        isNative: false,
        networkId,
      };
    }
    return token;
  }, [networkId, protocolInfo?.approveAsset, tokenInfo?.token]);

  const borrowSupplyApproveTarget = useMemo(() => {
    if (!useBorrowApi || borrowAction !== 'supply') {
      return undefined;
    }
    return buildBorrowTokenApproveTarget({
      accountId,
      networkId,
      spenderAddress: approveSpenderAddress,
      token: borrowSupplyApproveToken,
    });
  }, [
    accountId,
    approveSpenderAddress,
    borrowAction,
    borrowSupplyApproveToken,
    networkId,
    useBorrowApi,
  ]);

  const initialAllowanceTarget = resolveStakeInitialAllowanceTarget({
    borrowSupplyApproveTarget,
    approveType: effectiveApproveType,
    spenderAddress: approveSpenderAddress,
    token: effectiveStakeTokenInfo?.token,
  });

  const { result: initialAllowanceResult, isLoading: _isLoading = true } =
    usePromiseResult(
      async () => {
        if (
          !hasRequiredData ||
          !initialAllowanceTarget.approveType ||
          !initialAllowanceTarget.spenderAddress ||
          initialAllowanceTarget.token?.isNative
        ) {
          return undefined;
        }
        // While a protocol switch is in flight (confirm button force-loading),
        // networkId is already the new chain but token/spender still come from
        // the previous protocol's stale data — skip to avoid a mismatched
        // allowance request. Re-runs automatically once fresh data lands.
        if (footerActionOverride?.loading) {
          return undefined;
        }
        const { allowanceParsed } =
          await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
            accountId,
            networkId,
            spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
              networkId,
              approveType: initialAllowanceTarget.approveType,
              approveSpenderAddress: initialAllowanceTarget.spenderAddress,
            }),
            tokenAddress: initialAllowanceTarget.token?.address || '',
          });

        return { allowanceParsed };
      },
      [
        hasRequiredData,
        accountId,
        networkId,
        initialAllowanceTarget.approveType,
        initialAllowanceTarget.spenderAddress,
        initialAllowanceTarget.token?.isNative,
        initialAllowanceTarget.token?.address,
        footerActionOverride?.loading,
      ],
      {
        watchLoading: true,
      },
    );

  const handleStake = useUniversalStake({ accountId, networkId });
  const handleBorrowSupply = useUniversalBorrowSupply({ accountId, networkId });
  const handleBorrowBorrow = useUniversalBorrowBorrow({ accountId, networkId });

  const onConfirm = useCallback(
    async ({
      amount,
      approveType,
      permitSignature,
      unsignedMessage,
      message,
      effectiveApy,
      validatorPubkey,
      stakeType: confirmStakeType,
      onStepChange,
    }: IApproveConfirmFnParams) => {
      // Nothing was started, so the form keeps what the user typed.
      if (!hasRequiredData) return false;

      const token = effectiveStakeTokenInfo?.token as IToken;
      const effectiveStakeType = confirmStakeType ?? nativeStakeType;

      if (borrowApiCtx.isBorrow) return false;

      return handleStake({
        amount,
        approveType,
        permitSignature,
        unsignedMessage,
        message,
        symbol: stakeRequestSymbol,
        provider: providerName,
        inputTokenAddress: selectedStakeTokenAddress,
        outputTokenAddress: receiveInputConfig?.tokenAddress ?? '',
        slippage: pendleSlippage,
        effectiveApy,
        stakeType: effectiveStakeType,
        postWrapStakeToken:
          effectiveStakeType === 'wrap'
            ? nativeWrappedStakeAsset?.info
            : undefined,
        postWrapApproveSpenderAddress:
          effectiveStakeType === 'wrap' ? approveSpenderAddress : undefined,
        onStepChange,
        stakingInfo: {
          label: isPendleProvider ? EEarnLabels.Buy : EEarnLabels.Stake,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          send: { token, amount },
          tags: [protocolInfo?.stakeTag || ''],
        },
        // TODO: remove term after babylon remove term
        term: undefined,
        feeRate: Number(btcFeeRate) > 0 ? Number(btcFeeRate) : undefined,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? protocolInfo?.vault
          : undefined,
        // Stakefish specific param
        validatorPublicKey: validatorPubkey,
        onSuccess: async (txs) => {
          onSuccess?.({
            amount,
            symbol: token?.symbol,
            logoURI: token?.logoURI,
          });
          defaultLogger.staking.page.staking({
            token,
            stakingProtocol: providerName,
          });
          const tx = txs[0];
          if (approveType === EApproveType.Permit && permitSignature) {
            removePermitCache({
              accountId,
              networkId,
              tokenAddress: effectiveStakeTokenInfo?.token.address || '',
              amount,
            });
          }
          if (
            tx &&
            providerName.toLowerCase() ===
              EEarnProviderEnum.Babylon.toLowerCase()
          ) {
            await backgroundApiProxy.serviceStaking.addBabylonTrackingItem({
              txId: tx.decodedTx.txid,
              action: 'stake',
              createAt: Date.now(),
              accountId,
              networkId,
              amount,
              // TODO: remove term after babylon remove term
              minStakeTerm: undefined,
            });
          }
        },
      });
    },
    [
      hasRequiredData,
      effectiveStakeTokenInfo?.token,
      handleStake,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.vault,
      btcFeeRate,
      onSuccess,
      removePermitCache,
      accountId,
      networkId,
      providerName,
      protocolInfo?.stakeTag,
      selectedStakeTokenAddress,
      stakeRequestSymbol,
      receiveInputConfig?.tokenAddress,
      borrowApiCtx.isBorrow,
      pendleSlippage,
      isPendleProvider,
      nativeStakeType,
      nativeWrappedStakeAsset?.info,
      approveSpenderAddress,
    ],
  );

  const ensureRiskAccepted = useEarnRiskWarningGate();
  // Before a swap is sent: the provider's risk notice, then its own check of
  // what will reach it, so swapped tokens are never left without a deposit
  const handleBeforeSwap = useCallback(
    async (expectedAmount: string) => {
      const isAccepted = await ensureRiskAccepted({
        provider: providerName,
        symbol: depositSymbol,
        networkId,
      });
      if (!isAccepted) {
        return false;
      }
      let message: string | undefined;
      try {
        if (isBorrowStake) {
          const { provider, marketAddress, reserveAddress } =
            borrowApiCtx.borrowApiParams;
          const response =
            await backgroundApiProxy.serviceStaking.getBorrowCheckAmount({
              networkId,
              provider,
              marketAddress,
              reserveAddress,
              accountId,
              action: 'supply',
              amount: expectedAmount,
            });
          if (Number(response.code) !== 0) {
            message = response.message;
          } else if (response.data?.result === false) {
            message =
              response.data.alerts?.[0]?.text.text ||
              intl.formatMessage({ id: ETranslations.global_network_error });
          }
        } else {
          const response = await backgroundApiProxy.serviceStaking.checkAmount({
            accountId,
            networkId,
            symbol: stakeRequestSymbol || depositSymbol,
            provider: providerName,
            action: ECheckAmountActionType.STAKING,
            amount: expectedAmount,
            protocolVault: earnUtils.shouldSendEarnProtocolVault({
              providerName,
            })
              ? protocolInfo?.vault || ''
              : undefined,
            withdrawAll: false,
            stakeType: nativeStakeType,
            // Pendle's buy with the token the swap brings, checked as its own
            // form checks a buy
            ...(isPendleProvider && tokenInfo?.token
              ? {
                  inputTokenAddress: resolveStakeTokenAddress({
                    address: tokenInfo.token.address,
                    isNative: tokenInfo.token.isNative,
                  }),
                  outputTokenAddress: receiveInputConfig?.tokenAddress ?? '',
                  slippage: pendleSlippage,
                }
              : {}),
          });
          // The deposit form holds its button on an alert as on an error
          message =
            Number(response.code) === 0
              ? response.data?.alerts?.[0]?.text.text
              : response.message;
        }
      } catch {
        message = intl.formatMessage({
          id: ETranslations.global_network_error,
        });
      }
      if (message) {
        Toast.error({ title: message });
        return false;
      }
      return true;
    },
    [
      accountId,
      borrowApiCtx.borrowApiParams,
      depositSymbol,
      ensureRiskAccepted,
      intl,
      isBorrowStake,
      isPendleProvider,
      nativeStakeType,
      networkId,
      pendleSlippage,
      protocolInfo?.vault,
      providerName,
      receiveInputConfig?.tokenAddress,
      stakeRequestSymbol,
      tokenInfo?.token,
    ],
  );
  // The balance the swap left, read on chain, until the page's own catches up
  const handoffBalance = useMemo(() => {
    if (!handoff?.balance) {
      return undefined;
    }
    const own = new BigNumber(effectiveStakeTokenInfo?.balanceParsed ?? '');
    return BigNumber.max(own.isFinite() ? own : 0, handoff.balance).toFixed();
  }, [effectiveStakeTokenInfo?.balanceParsed, handoff?.balance]);
  // Pendle's form presses itself once it is on the token the swap brought,
  // never on another token it takes
  const isOnSwappedToken =
    !isPendleProvider ||
    normalizeStakeTokenAddress({
      address: effectiveStakeTokenInfo?.token.address,
      isNative: effectiveStakeTokenInfo?.token.isNative,
    }) === swapTokenAddress;
  const handoffSubmitKey =
    handoff?.target === handoffTarget && isOnSwappedToken
      ? handoff.autoSubmitKey
      : undefined;

  // Determine the effective max balance for supply
  const effectiveMaxBalance = useMemo(() => {
    if (borrowAction !== 'supply') {
      return undefined;
    }
    return protocolInfo?.maxSupplyBalance;
  }, [borrowAction, protocolInfo?.maxSupplyBalance]);
  const unsupportedAaveNativeReserve = useMemo(
    () =>
      isUnsupportedAaveNativeReserve({
        networkId,
        providerName: providerName || borrowApiCtx.borrowApiParams?.provider,
        reserveAddress: borrowApiCtx.borrowApiParams?.reserveAddress,
      }),
    [
      borrowApiCtx.borrowApiParams?.provider,
      borrowApiCtx.borrowApiParams?.reserveAddress,
      networkId,
      providerName,
    ],
  );

  const onBorrowConfirm = useCallback(
    async (params: IManagePositionConfirmParams) => {
      const { amount } = params;
      if (
        !hasRequiredData ||
        !borrowApiCtx.isBorrow ||
        unsupportedAaveNativeReserve
      ) {
        // Nothing was started, so the form keeps what the user typed.
        return false;
      }

      const token = tokenInfo?.token as IToken;
      const { provider, marketAddress, reserveAddress, action } =
        borrowApiCtx.borrowApiParams;
      const shouldUnwrapNativeAaveReserve =
        action === 'borrow' &&
        shouldUseAaveNativeGateway({
          networkId,
          providerName: provider,
          reserveAddress,
        });
      const receiveToken = shouldUnwrapNativeAaveReserve
        ? buildAaveNativeGatewayReceiveToken({
            token,
            nativeToken: tokenInfo?.nativeToken?.info,
            networkId,
          })
        : token;

      // Build tags array with both new borrow tag and legacy stakeTag for backward compatibility
      const tags: string[] = [EEarnLabels.Borrow];
      if (action === 'supply' || action === 'borrow') {
        tags.push(buildBorrowTag({ provider, action }));
      }
      // Keep legacy stakeTag for backward compatibility
      if (protocolInfo?.stakeTag) {
        tags.push(protocolInfo.stakeTag);
      }

      return (action === 'borrow' ? handleBorrowBorrow : handleBorrowSupply)({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        ...(shouldUnwrapNativeAaveReserve ? { unwrap: true } : {}),
        stakingInfo: token
          ? {
              label:
                action === 'borrow' ? EEarnLabels.Borrow : EEarnLabels.Supply,
              protocol: borrowProviderDisplayName,
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              ...(action === 'borrow'
                ? { receive: { token: receiveToken ?? token, amount } }
                : { send: { token, amount } }),
              tags,
            }
          : undefined,
        onSuccess: async () => {
          onSuccess?.({
            amount,
            symbol: token?.symbol,
            logoURI: token?.logoURI,
          });
        },
      });
    },
    [
      borrowApiCtx,
      borrowProviderDisplayName,
      handleBorrowBorrow,
      handleBorrowSupply,
      hasRequiredData,
      networkId,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      tokenInfo?.nativeToken?.info,
      tokenInfo?.token,
      unsupportedAaveNativeReserve,
    ],
  );

  // If no required data, render placeholder to maintain layout. With Pay
  // with it also waits for the wallet, so the form doesn't change kind once
  // the token it starts on is known; and where the form buys with one of
  // the tokens it takes (Pendle), for that list and the pick from it: the
  // form is keyed by that token, so starting on its own token and changing
  // a moment later would build it again, restarting what it shows
  const isStakeAssetComing =
    needsStakeAssets &&
    (!stakeAssetsList ||
      (selectableStakeAssets.length > 0 && !selectedStakeAsset));
  if (
    !hasRequiredData ||
    (canPayWith &&
      ((Boolean(depositSymbol) && !pay.isLoaded) || isStakeAssetComing))
  ) {
    if (
      useBorrowApi &&
      borrowMarketAddress &&
      borrowReserveAddress !== undefined &&
      (borrowAction === 'supply' || borrowAction === 'borrow')
    ) {
      return (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName=""
          action={borrowAction}
          balance="0"
          price="0"
          tokenImageUri={fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          isDisabled
          borrowMarketAddress={borrowMarketAddress}
          borrowReserveAddress={borrowReserveAddress}
          beforeFooter={beforeFooter}
          actionLabel={borrowActionLabel}
          inputTitle={payInputTitle}
          showSwapOrBridge={!canPayWith}
          offerSwitch={offerSwitch}
          isInModalContext={isInModalContext}
          isEarnForm
        />
      );
    }
    // Once the protocol is known, the protocol's own layout (Pendle's line,
    // rows and button) and the token the form is likely to start on: Pay
    // with's pick once the wallet is read, the page's token before that. The
    // form that follows then only fills it in
    const standInToken = hasRequiredData ? payToken?.token : undefined;
    let standInSymbol = tokenInfo?.token.symbol;
    if (standInToken) {
      standInSymbol = standInToken.symbol;
    } else if (canPayWith && hasRequiredData) {
      standInSymbol = depositSymbol;
    }
    // The logo always the symbol's. Pendle's page image is its route's, not
    // the token's, so until the token is known its place holds a
    // placeholder, as in the loading frame before
    let standInImage = standInToken?.logoURI;
    if (!standInToken && tokenInfo?.token.symbol === standInSymbol) {
      standInImage = tokenInfo?.token.logoURI;
    }
    if (!standInImage && !standInToken && !isPendleProvider) {
      standInImage = fallbackTokenImageUri;
    }
    return (
      <UniversalStake
        accountId={accountId}
        networkId={networkId}
        balance={payToken?.amount ?? '0'}
        balanceLoading={canPayWith && hasRequiredData && !payToken}
        tokenImageUri={standInImage}
        tokenImageLoading={!standInImage}
        tokenSymbol={standInSymbol}
        isDisabled
        inputTitle={payInputTitle}
        hideTradeOrBuy={canPayWith}
        offerSwitch={offerSwitch}
        approveTarget={{
          accountId,
          networkId,
          spenderAddress: '',
        }}
        isInModalContext={isInModalContext}
        beforeFooter={beforeFooter}
        footerActionOverride={footerActionOverride}
        confirmWordIdWhileLoading={confirmWordIdWhileLoading}
        protocolSwitchConfig={protocolSwitchConfig}
        providerName={hasRequiredData ? providerName : undefined}
        providerLogo={protocolInfo?.providerDetail.logoURI}
        receiveInputConfig={hasRequiredData ? receiveInputConfig : undefined}
        showApyDetail={showApyDetail}
        approveType={hasRequiredData ? effectiveApproveType : undefined}
        tokenSelectorTriggerProps={
          hasRequiredData ? stakeTokenSelectorTriggerProps : undefined
        }
      />
    );
  }

  // The swap needs the token it buys: the page's own, once it's known
  const depositTokenToBuy =
    tokenInfo?.token && tokenInfo.token.decimals > 0
      ? tokenInfo.token
      : undefined;
  if (isSwapPath && payToken && depositTokenToBuy) {
    // The wallet's entry for the token the swap buys, for its price
    const heldSwapToken = pay.tokens.find((item) =>
      isPendleProvider
        ? getPayTokenAddress(item) === swapTokenAddress
        : item.isDepositToken,
    );
    // The deposit form's own word for it: Supply on a lending market, Buy
    // on Pendle. The line under the box says what that brings, and for
    // Pendle what its own form says: the PT you receive
    let actionLabel = intl.formatMessage({ id: ETranslations.earn_deposit });
    let depositLineLabel = EARN_DESKTOP_DEMO_COPY.youDeposit;
    if (isBorrowStake) {
      actionLabel =
        borrowActionLabel ??
        intl.formatMessage({ id: ETranslations.defi_supply });
      depositLineLabel = EARN_DESKTOP_DEMO_COPY.youSupply;
    } else if (isPendleProvider) {
      actionLabel = intl.formatMessage({ id: ETranslations.global_buy });
      depositLineLabel = intl.formatMessage({
        id: ETranslations.swap_review_you_receive,
      });
    }
    return (
      <EarnRouterSwapDepositForm
        // Another provider or token starts the form over
        key={`${providerName}|${protocolInfo?.vault ?? ''}|${payToken.key}`}
        accountId={accountId}
        networkId={networkId}
        // A bridge pays from the token's own network and account
        payNetworkId={
          payMode === 'bridgeThenDeposit' ? payToken.networkId : undefined
        }
        payAccountId={
          payMode === 'bridgeThenDeposit'
            ? payToken.accountId || accountId
            : undefined
        }
        actionLabel={actionLabel}
        depositLineLabel={depositLineLabel}
        isDisabled={isDisabled}
        apr={payOfferApr}
        payToken={payToken}
        depositToken={{
          // Pendle's buy side's token is not the page's
          symbol: isPendleProvider ? depositTokenToBuy.symbol : depositSymbol,
          name: depositTokenToBuy.name,
          logoURI: depositTokenToBuy.logoURI || fallbackTokenImageUri,
          priceUsd:
            heldSwapToken && Number(heldSwapToken.priceUsd) > 0
              ? heldSwapToken.priceUsd
              : String(tokenInfo?.price ?? '0'),
          address: depositTokenToBuy.address,
          decimals: depositTokenToBuy.decimals,
          isNative: depositTokenToBuy.isNative,
          inputDecimals: protocolInfo?.protocolInputDecimals,
        }}
        onOpenPayWith={handleOpenPayWith}
        payWithTrigger={payWithTrigger}
        onSwapped={handleSwapped}
        onRefreshBalance={handleRefreshPayBalance}
        beforeSwap={handleBeforeSwap}
        footerActionOverride={footerActionOverride}
        isInModalContext={isInModalContext}
        summaryRequest={paySummaryRequest}
        revealsDepositLine={revealsDepositLine}
        initialAmount={inputStartAmount}
        onAmountChange={handleAmountChange}
        protocolSwitch={
          protocolSwitchConfig ? (
            <ProtocolSwitcher
              tokenSymbol={depositSymbol}
              accountId={accountId}
              fallbackProviderName={providerName}
              fallbackProviderLogoUri={protocolInfo?.providerDetail.logoURI}
              protocolSwitchConfig={protocolSwitchConfig}
            />
          ) : undefined
        }
        offerSwitch={offerSwitch}
      />
    );
  }

  return (
    <EarnBalanceNoteContext.Provider value={payBalanceNote}>
      {isBorrowStake ? (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName={providerName}
          action={borrowApiCtx.borrowApiParams.action as 'supply' | 'borrow'}
          decimals={
            protocolInfo?.protocolInputDecimals ?? tokenInfo?.token?.decimals
          }
          balance={handoffBalance ?? tokenInfo?.balanceParsed ?? ''}
          maxBalance={effectiveMaxBalance}
          initialAmount={inputStartAmount}
          autoSubmitKey={handoffSubmitKey}
          onAutoSubmit={handleAutoSubmit}
          offerSwitch={offerSwitch}
          onAmountChange={handleAmountChange}
          onTokenSelectorPress={canPayWith ? handleOpenPayWith : undefined}
          onRefreshBalance={canPayWith ? handleRefreshPayBalance : undefined}
          payWithTrigger={
            canPayWith
              ? {
                  ...buildKeyboardPressProps(handleOpenPayWith),
                  ...payWithTrigger,
                }
              : undefined
          }
          inputTitle={payInputTitle}
          showSwapOrBridge={!canPayWith}
          tokenImageUri={tokenInfo?.token.logoURI || fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          onConfirm={onBorrowConfirm}
          approveType={
            borrowApiCtx.borrowApiParams.action === 'supply'
              ? EApproveType.Legacy
              : undefined
          }
          approveTarget={borrowSupplyApproveTarget}
          currentAllowance={
            borrowApiCtx.borrowApiParams.action === 'supply'
              ? (initialAllowanceResult?.allowanceParsed ??
                protocolInfo?.approve?.allowance)
              : undefined
          }
          tokenInfo={tokenInfo}
          isDisabled={isDisabled || unsupportedAaveNativeReserve}
          borrowDelegationApproveTarget={borrowDelegationApproveTarget}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={
            borrowApiCtx.borrowApiParams?.reserveAddress ?? ''
          }
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
          isInModalContext={isInModalContext}
          isEarnForm
        />
      ) : (
        <UniversalStake
          // Include protocol identity (provider/vault) so switching between
          // protocols that share the same deposit token still remounts the
          // form and drops the previous protocol's transactionConfirmation.
          // Sourced from protocolInfo (same origin as the manage data), so the
          // key flips exactly when fresh protocol data lands.
          key={`stake-input-${protocolInfo?.provider ?? ''}-${protocolInfo?.vault ?? ''}-${selectedStakeTokenUniqueKey || tokenInfo?.token?.uniqueKey || 'default'}`}
          accountId={accountId}
          networkId={networkId}
          decimals={
            protocolInfo?.protocolInputDecimals ??
            effectiveStakeTokenInfo?.token?.decimals
          }
          balance={
            handoffBalance ?? effectiveStakeTokenInfo?.balanceParsed ?? ''
          }
          initialAmount={inputStartAmount}
          autoSubmitKey={handoffSubmitKey}
          onAutoSubmit={handleAutoSubmit}
          offerSwitch={offerSwitch}
          onAmountChange={handleAmountChange}
          tokenImageUri={
            effectiveStakeTokenInfo?.token.logoURI || fallbackTokenImageUri
          }
          // Token metadata not in yet and no image came from route params:
          // skeleton the icon rather than flashing the placeholder coin.
          // Guarded on the metadata being absent (not merely on a missing
          // image) so a token that genuinely has no logo still renders its
          // fallback instead of a skeleton that never resolves (OK-59961).
          tokenImageLoading={
            !effectiveStakeTokenInfo?.token && !fallbackTokenImageUri
          }
          tokenSymbol={effectiveStakeTokenInfo?.token.symbol}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={protocolInfo?.provider}
          onConfirm={onConfirm}
          approveType={effectiveApproveType}
          currentAllowance={initialAllowanceResult?.allowanceParsed}
          minTransactionFee={protocolInfo?.minTransactionFee}
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
          tokenInfo={effectiveStakeTokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={isDisabled}
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: approveSpenderAddress,
            token: effectiveStakeTokenInfo?.token,
          }}
          postWrapApproveTarget={
            nativeStakeType === 'wrap'
              ? {
                  spenderAddress: approveSpenderAddress,
                  token: nativeWrappedStakeAsset?.info,
                }
              : undefined
          }
          beforeFooter={beforeFooter}
          footerActionOverride={footerActionOverride}
          confirmWordIdWhileLoading={confirmWordIdWhileLoading}
          showApyDetail={showApyDetail}
          suppressPlatformBonus={suppressPlatformBonus}
          isInModalContext={isInModalContext}
          protocolSwitchConfig={protocolSwitchConfig}
          ongoingValidator={ongoingValidator}
          receiveInputConfig={receiveInputConfig}
          inputTitle={payInputTitle}
          hideTradeOrBuy={canPayWith}
          collapsesDepositLine={collapsesDepositLine}
          tokenSelectorTriggerProps={stakeTokenSelectorTriggerProps}
          onRefreshBalance={canPayWith ? handleRefreshPayBalance : undefined}
          requestSymbol={stakeRequestSymbol}
          transactionInputTokenAddress={selectedStakeTokenAddress}
          transactionOutputTokenAddress={receiveInputConfig?.tokenAddress ?? ''}
          stakeType={nativeStakeType}
          isQuoteExpired={isQuoteExpired}
          onQuoteReset={onQuoteReset}
          refreshKey={refreshKey}
          onQuoteRefreshingChange={onQuoteRefreshingChange}
          pendleSlippage={pendleSlippage}
        />
      )}
    </EarnBalanceNoteContext.Provider>
  );
};
