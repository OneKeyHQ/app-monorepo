import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import {
  Button,
  Dialog,
  Form,
  HeightTransition,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  TextArea,
  TextAreaInput,
  XStack,
  YStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { calcPercentBalance } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { LightningUnitSwitch } from '@onekeyhq/kit/src/components/UnitSwitch';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import {
  useSelectedUTXOsAtom,
  useSendConfirmActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  openFiatCryptoUrl,
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IAddressValidateStatus } from '@onekeyhq/shared/types/address';
import { ELightningUnit } from '@onekeyhq/shared/types/lightning';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useSupportToken } from '../../../FiatCrypto/hooks';
import { showBalanceDetailsDialog } from '../../../Home/components/BalanceDetailsDialog';
import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { showSimilarAddressDialog } from '../../../SignatureConfirm/components/SimilarAddressDialog/SimilarAddressDialog';
import CoinControlBadge from '../../components/CoinControlBadge';
import {
  type ISendAmountAutoSizeInputRef,
  SendAutoSizeAmountInput,
} from '../../components/SendAutoSizeAmountInput';
import { SendConfirmProviderMirror } from '../../components/SendConfirmProvider/SendConfirmProviderMirror';

import type { RouteProp } from '@react-navigation/core';

export const amountInputAccessoryViewID = 'send-amount-input-accessory-view';

interface IAmountFormValues {
  accountId: string;
  networkId: string;
  amount: string;
  nftAmount: string;
  txMessage: string;
}

// Floor a fiat-derived token amount to the precision the chain can actually
// send. Lightning amounts are in sats (smallest unit, 0 decimals) — fractional
// sats cause OK-53396. Other chains floor to `tokenDetails.info.decimals` so
// the value stays representable. Keeping this in one place ensures the value
// shown in the input, the value used by validation, and the value submitted
// to the vault stay strictly equal.
function floorFiatDerivedTokenAmount({
  amount,
  isLightningNetwork,
  decimals,
}: {
  amount: BigNumber;
  isLightningNetwork: boolean;
  decimals: number | undefined;
}): BigNumber {
  if (isLightningNetwork) {
    return amount.integerValue(BigNumber.ROUND_FLOOR);
  }
  if (
    typeof decimals === 'number' &&
    Number.isInteger(decimals) &&
    decimals >= 0
  ) {
    return amount.decimalPlaces(decimals, BigNumber.ROUND_FLOOR);
  }
  return amount;
}

function SendAmountInputContainer() {
  const intl = useIntl();
  const _media = useMedia();

  const [isUseFiat, setIsUseFiat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaxSend, setIsMaxSend] = useState(false);
  const [settings] = useSettingsPersistAtom();
  const [selectedUTXOs] = useSelectedUTXOsAtom();
  const sendConfirmActions = useSendConfirmActions();

  const route =
    useRoute<
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.TxAmountInput
      >
    >();

  const {
    networkId,
    accountId,
    isNFT,
    token,
    nfts,
    recipientAddress,
    recipientMemo,
    recipientPaymentId,
    recipientNote,
    recipientIsContract,
    onSuccess,
    onFail,
    onCancel,
    amount: prefillAmount,
    isInvoiceAmountLocked,
  } = route.params;

  const nft = nfts?.[0];
  const [tokenInfo] = useState(token);

  const onSubmitRef = useRef<() => Promise<void>>(undefined);
  const navigation = useAppNavigation();

  const [currentAccountId, setCurrentAccountId] = useState(accountId);

  const { account, network, vaultSettings, deriveInfo, deriveType } =
    useAccountData({
      accountId: currentAccountId,
      networkId,
    });

  const walletId = useMemo(
    () =>
      accountUtils.getWalletIdFromAccountId({ accountId: currentAccountId }),
    [currentAccountId],
  );

  const signatureConfirm = useSignatureConfirm({
    accountId: currentAccountId,
    networkId,
  });

  const form = useForm<IAmountFormValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      accountId,
      networkId,
      amount: prefillAmount || '0',
      nftAmount: isNFT && nft?.collectionType === ENFTType.ERC1155 ? '' : '1',
      txMessage: '',
    },
  });

  const amount = form.watch('amount');
  const nftAmount = form.watch('nftAmount');
  const hasAmountError = !!form.formState.errors.amount;
  const txMessage = form.watch('txMessage');

  const { serviceToken, serviceNFT } = backgroundApiProxy;

  const {
    result: [tokenDetails, nftDetails, hasFrozenBalance] = [],
    isLoading: isLoadingAssets,
  } = usePromiseResult(
    async () => {
      if (!account?.id || !network?.id) return;
      if (!token && !nft) return;

      let nftResp: IAccountNFT[] | undefined;
      let tokenResp:
        | ({
            info: IToken;
          } & ITokenFiat)[]
        | undefined;

      if (isNFT && nft) {
        nftResp = await serviceNFT.fetchNFTDetails({
          accountId: account.id,
          networkId: network.id,
          nfts: [
            {
              collectionAddress: nft.collectionAddress,
              itemId: nft.itemId,
            },
          ],
        });
      } else if (!isNFT && tokenInfo) {
        const checkInscriptionProtectionEnabled =
          await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
            {
              networkId: network.id,
              accountId: account.id,
            },
          );
        const withCheckInscription =
          checkInscriptionProtectionEnabled && settings.inscriptionProtection;
        tokenResp = await serviceToken.fetchTokensDetails({
          networkId: network.id,
          accountId: account.id,
          contractList: [tokenInfo.address],
          withFrozenBalance: true,
          withCheckInscription,
        });
      }

      const frozenBalanceSettings =
        await backgroundApiProxy.serviceSend.getFrozenBalanceSetting({
          networkId: network.id,
          tokenDetails: tokenResp?.[0],
        });

      return [tokenResp?.[0], nftResp?.[0], frozenBalanceSettings];
    },
    [
      account,
      isNFT,
      network,
      nft,
      serviceNFT,
      serviceToken,
      token,
      tokenInfo,
      settings.inscriptionProtection,
    ],
    { watchLoading: true, alwaysSetState: true },
  );

  // Calculate balanceParsed if not provided
  if (tokenDetails && isNil(tokenDetails?.balanceParsed)) {
    tokenDetails.balanceParsed = new BigNumber(tokenDetails.balance)
      .shiftedBy(tokenDetails.info.decimals * -1)
      .toFixed();
  }

  const [lnUnit, setLnUnit] = useState<ELightningUnit>(ELightningUnit.SATS);

  const isLightningNetwork = useMemo(
    () => networkUtils.isLightningNetworkByNetworkId(networkId),
    [networkId],
  );
  const enableAllowListValidation = !isLightningNetwork;

  const currencySymbol = settings.currencyInfo.symbol;
  const tokenSymbol = useMemo(() => {
    if (isNFT) return nft?.metadata?.name ?? '';
    if (isLightningNetwork && lnUnit === ELightningUnit.BTC) return 'BTC';
    if (isLightningNetwork && lnUnit === ELightningUnit.SATS) return 'sats';
    return tokenInfo?.symbol ?? '';
  }, [
    isNFT,
    isLightningNetwork,
    lnUnit,
    tokenInfo?.symbol,
    nft?.metadata?.name,
  ]);

  const currentSelectedUtxoInfo = useMemo(() => {
    if (
      selectedUTXOs &&
      selectedUTXOs.networkId === networkId &&
      selectedUTXOs.accountId === currentAccountId &&
      selectedUTXOs.selectedUtxoKeys.length > 0
    ) {
      return {
        keys: selectedUTXOs.selectedUtxoKeys,
        totalValue: selectedUTXOs.selectedUtxoTotalValue,
        strategy: selectedUTXOs.utxoSelectionStrategy,
      };
    }
    return undefined;
  }, [selectedUTXOs, networkId, currentAccountId]);

  const maxBalance = useMemo(() => {
    if (!tokenDetails) return '0';
    let balance: string;
    if (currentSelectedUtxoInfo?.totalValue && tokenDetails.info) {
      balance = new BigNumber(
        chainValueUtils.convertTokenChainValueToAmount({
          value: currentSelectedUtxoInfo.totalValue,
          token: tokenDetails.info,
        }),
      ).toFixed();
    } else {
      balance = tokenDetails.balanceParsed;
    }

    // Lightning balanceParsed is already in sats (decimals=0)
    if (isLightningNetwork && lnUnit === ELightningUnit.BTC) {
      return chainValueUtils.convertSatsToBtc(balance);
    }

    return balance;
  }, [
    currentSelectedUtxoInfo?.totalValue,
    isLightningNetwork,
    lnUnit,
    tokenDetails,
  ]);

  const maxBalanceFiat = useMemo(() => {
    if (!tokenDetails) return '0';
    if (
      currentSelectedUtxoInfo?.totalValue &&
      tokenDetails.price &&
      tokenDetails.info
    ) {
      const balanceInToken = new BigNumber(
        chainValueUtils.convertTokenChainValueToAmount({
          value: currentSelectedUtxoInfo.totalValue,
          token: tokenDetails.info,
        }),
      );
      return balanceInToken.times(tokenDetails.price).toFixed();
    }
    return tokenDetails.fiatValue ?? '0';
  }, [tokenDetails, currentSelectedUtxoInfo?.totalValue]);

  const linkedAmount = useMemo(() => {
    const amountBN = new BigNumber(amount || 0);
    // For Lightning in BTC mode, the input is in BTC but price is per-sat.
    // Convert BTC→sats first to match the price unit.
    const amountForPrice =
      isLightningNetwork && lnUnit === ELightningUnit.BTC
        ? new BigNumber(chainValueUtils.convertBtcToSats(amountBN.toFixed()))
        : amountBN;

    if (isUseFiat) {
      const price = new BigNumber(tokenDetails?.price ?? 0);
      if (price.isZero()) {
        return { originalAmount: '0', linkedAmount: '0' };
      }
      // fiat / pricePerSat = sats. Convert to BTC if lnUnit is BTC.
      let originalAmt = floorFiatDerivedTokenAmount({
        amount: amountBN.dividedBy(price),
        isLightningNetwork,
        decimals: tokenDetails?.info.decimals,
      });
      if (isLightningNetwork && lnUnit === ELightningUnit.BTC) {
        originalAmt = new BigNumber(
          chainValueUtils.convertSatsToBtc(originalAmt.toFixed()),
        );
      }
      return {
        originalAmount: originalAmt.toFixed(),
        linkedAmount: amountBN.toFixed(),
      };
    }
    const price = new BigNumber(tokenDetails?.price ?? 0);
    const linkedAmountValue = amountForPrice.multipliedBy(price);
    return {
      originalAmount: amountBN.toFixed(),
      linkedAmount: linkedAmountValue.toFixed(),
    };
  }, [
    amount,
    isLightningNetwork,
    isUseFiat,
    lnUnit,
    tokenDetails?.info.decimals,
    tokenDetails?.price,
  ]);

  const handleToggleFiatMode = useCallback(() => {
    // When currently in fiat mode (isUseFiat=true), switching to token mode -> use originalAmount
    // When currently in token mode (isUseFiat=false), switching to fiat mode -> use linkedAmount
    let amountValue = isUseFiat
      ? linkedAmount.originalAmount
      : linkedAmount.linkedAmount;
    // Truncate decimal places when switching back to crypto mode
    if (isUseFiat && amountValue) {
      // Lightning BTC mode: originalAmount is in BTC, use BTC decimals (8)
      // Lightning native decimals is 0 (sats), which would truncate BTC values to 0
      let decimals = tokenDetails?.info.decimals ?? 8;
      if (isLightningNetwork && lnUnit === ELightningUnit.BTC) {
        decimals = chainValueUtils.getLightningAmountDecimals({
          lnUnit,
          decimals,
        });
      }
      const valueBN = new BigNumber(amountValue);
      if (!valueBN.isNaN() && (valueBN.decimalPlaces() ?? 0) > decimals) {
        amountValue = valueBN.toFixed(decimals, BigNumber.ROUND_FLOOR);
      }
    }
    setIsUseFiat((prev) => !prev);
    // Don't validate here — the validator closes over the stale isUseFiat
    // value, causing false min-amount errors (OK-52679). A useEffect below
    // re-triggers validation after isUseFiat state has propagated.
    form.setValue('amount', amountValue);
  }, [
    form,
    isLightningNetwork,
    isUseFiat,
    linkedAmount.linkedAmount,
    linkedAmount.originalAmount,
    lnUnit,
    tokenDetails?.info.decimals,
  ]);

  // Re-validate amount after isUseFiat state propagates so the validator
  // reads the correct mode. Fixes false min-amount errors on toggle (OK-52679).
  const isUseFiatRef = useRef(isUseFiat);
  useEffect(() => {
    if (isUseFiatRef.current !== isUseFiat) {
      isUseFiatRef.current = isUseFiat;
      void form.trigger('amount');
    }
  }, [isUseFiat, form]);

  const isIntegerAmount = useMemo(() => {
    if (!isUseFiat && isLightningNetwork && lnUnit === ELightningUnit.SATS) {
      return true;
    }
    return false;
  }, [isLightningNetwork, isUseFiat, lnUnit]);

  const tokenMinAmount = useMemo(() => {
    const decimals = tokenDetails?.info.decimals;
    if (decimals === undefined || Number.isNaN(decimals)) {
      return undefined;
    }
    return new BigNumber(1).shiftedBy(-decimals).toFixed();
  }, [tokenDetails?.info.decimals]);

  const minAmountHint = useMemo(() => {
    if (!tokenSymbol || tokenMinAmount === undefined) return undefined;
    const isNative = tokenDetails?.info.isNative;
    // Only show the hint when the chain enforces a meaningful chain-level
    // minimum. Without that, displaying the token-precision floor (e.g.
    // 1e-18 for an 18-decimal ERC20) is noise.
    const chainMinRaw = isNative
      ? (vaultSettings?.nativeMinTransferAmount ??
        vaultSettings?.minTransferAmount)
      : vaultSettings?.minTransferAmount;
    if (!chainMinRaw || new BigNumber(chainMinRaw).isLessThanOrEqualTo(0)) {
      return undefined;
    }
    // Mirror the validator's effectiveMin = max(tokenPrecisionMin, chainMin)
    // so the hint matches the value the validator actually rejects against.
    const effectiveMin = BigNumber.max(tokenMinAmount, chainMinRaw).toFixed();
    // Lightning BTC unit displays the min converted from sats.
    const displayMinAmount =
      isLightningNetwork && lnUnit === ELightningUnit.BTC
        ? chainValueUtils.convertSatsToBtc(effectiveMin)
        : effectiveMin;
    return intl.formatMessage(
      { id: ETranslations.send_error_minimum_amount },
      { amount: displayMinAmount, token: tokenSymbol },
    );
  }, [
    intl,
    isLightningNetwork,
    lnUnit,
    tokenDetails?.info.isNative,
    tokenMinAmount,
    tokenSymbol,
    vaultSettings?.minTransferAmount,
    vaultSettings?.nativeMinTransferAmount,
  ]);

  const handleValidateTokenAmount = useCallback(
    async (value: string): Promise<string | undefined> => {
      if (!value) {
        return intl.formatMessage({
          id: ETranslations.send_amount_invalid,
        });
      }

      const amountBN = new BigNumber(value);
      if (amountBN.isNaN() || amountBN.isNegative()) {
        return intl.formatMessage({
          id: ETranslations.send_amount_invalid,
        });
      }

      const priceBN = new BigNumber(tokenDetails?.price ?? 0);
      // Mirror the flooring applied in `linkedAmount` so the value validated
      // here matches the value submitted to the vault. Without this, fiat
      // mode could pass min/balance checks against the raw fiat/price result
      // while the user actually sends a smaller, floored value.
      const tokenAmountBN =
        isUseFiat && priceBN.isGreaterThan(0)
          ? floorFiatDerivedTokenAmount({
              amount: amountBN.dividedBy(priceBN),
              isLightningNetwork,
              decimals: tokenDetails?.info.decimals,
            })
          : amountBN;

      // For Lightning, normalize amount to sats for validation
      // (minTransferAmount and backend validation expect sats)
      // In fiat mode, tokenAmountBN = fiat/pricePerSat = already sats, skip conversion.
      // In token mode with BTC unit, convert BTC→sats.
      // In token mode with SATS unit, already sats.
      let amountBNForValidation = tokenAmountBN;
      if (isLightningNetwork && !isUseFiat) {
        amountBNForValidation =
          lnUnit === ELightningUnit.BTC
            ? new BigNumber(
                chainValueUtils.convertBtcToSats(tokenAmountBN.toFixed()),
              )
            : tokenAmountBN; // already in sats
      }

      // Block flow if token decimals is missing — server must return explicit decimals
      if (tokenMinAmount === undefined) {
        return intl.formatMessage({
          id: ETranslations.send_amount_invalid,
        });
      }

      // Minimum transfer amount check
      const isNative = tokenDetails?.info.isNative;
      const minTransferAmount = isNative
        ? (vaultSettings?.nativeMinTransferAmount ??
          vaultSettings?.minTransferAmount ??
          '0')
        : (vaultSettings?.minTransferAmount ?? '0');

      // Effective minimum: the larger of token precision minimum and chain minimum
      const effectiveMin = BigNumber.max(
        tokenMinAmount,
        minTransferAmount,
      ).toFixed();

      // Display min amount in the current unit (BTC or sats for Lightning)
      const displayMinAmount =
        isLightningNetwork && lnUnit === ELightningUnit.BTC
          ? chainValueUtils.convertSatsToBtc(effectiveMin)
          : effectiveMin;

      if (
        !isUseFiat &&
        !new BigNumber(effectiveMin).isZero() &&
        amountBNForValidation.isLessThan(effectiveMin) &&
        !amountBNForValidation.isZero()
      ) {
        return intl.formatMessage(
          { id: ETranslations.send_error_minimum_amount },
          { amount: displayMinAmount, token: tokenSymbol },
        );
      }

      if (
        isUseFiat &&
        priceBN.isGreaterThan(0) &&
        !new BigNumber(effectiveMin).isZero() &&
        tokenAmountBN.isLessThan(effectiveMin) &&
        !tokenAmountBN.isZero()
      ) {
        return intl.formatMessage(
          { id: ETranslations.send_error_minimum_amount },
          { amount: displayMinAmount, token: tokenSymbol },
        );
      }

      // A positive fiat input that floors to 0 token (sub-sat on Lightning,
      // or sub-decimal on other chains) would otherwise slip past the min
      // check above (which excludes isZero) and the native-only zero guard
      // below, letting the user submit a 0-amount transfer.
      if (
        isUseFiat &&
        priceBN.isGreaterThan(0) &&
        tokenAmountBN.isZero() &&
        !amountBN.isZero()
      ) {
        return intl.formatMessage({
          id: ETranslations.send_amount_too_small,
        });
      }

      // Zero native token transfer prevention
      if (
        !isNFT &&
        isNative &&
        tokenAmountBN.isZero() &&
        !vaultSettings?.transferZeroNativeTokenEnabled
      ) {
        return intl.formatMessage({
          id: ETranslations.send_cannot_send_amount_zero,
        });
      }

      // Vault-specific validation
      try {
        // For Lightning, amountBNForValidation is always in sats.
        // balanceParsed is also in sats (decimals=0). Use it directly
        // instead of maxBalance which may be in BTC when lnUnit=BTC.
        const validationBalance = isLightningNetwork
          ? (tokenDetails?.balanceParsed ?? '0')
          : maxBalance;
        await backgroundApiProxy.serviceValidator.validateSendAmount({
          accountId: currentAccountId,
          networkId,
          amount: amountBNForValidation.toFixed(),
          tokenBalance: validationBalance,
          to: recipientAddress ?? '',
          isNative,
        });
      } catch (e) {
        return (e as Error).message;
      }

      return undefined;
    },
    [
      intl,
      isLightningNetwork,
      lnUnit,
      tokenDetails?.balanceParsed,
      tokenDetails?.info.decimals,
      tokenDetails?.info.isNative,
      tokenDetails?.price,
      tokenMinAmount,
      vaultSettings?.nativeMinTransferAmount,
      vaultSettings?.minTransferAmount,
      vaultSettings?.transferZeroNativeTokenEnabled,
      isUseFiat,
      isNFT,
      tokenSymbol,
      currentAccountId,
      networkId,
      maxBalance,
      recipientAddress,
    ],
  );

  // Check if balance is insufficient (show on button instead of form error)
  const isInsufficientBalance = useMemo(() => {
    if (!amount || amount === '0') return false;
    const valueBN = new BigNumber(amount);
    if (valueBN.isNaN() || valueBN.isNegative()) return false;

    if (isUseFiat) {
      const fiatValue = new BigNumber(maxBalanceFiat);
      return valueBN.isGreaterThan(fiatValue);
    }
    const balance = new BigNumber(maxBalance);
    return valueBN.isGreaterThan(balance);
  }, [amount, isUseFiat, maxBalanceFiat, maxBalance]);

  // Buy button support for insufficient balance
  const showReviewControl = useReviewControl();
  const { result: isBuySupported } = useSupportToken(
    networkId,
    tokenInfo?.address ?? '',
    'buy',
  );
  const isWatchingWallet = useMemo(
    () => accountUtils.isWatchingAccount({ accountId: currentAccountId }),
    [currentAccountId],
  );
  const showBuyButton = useMemo(
    () =>
      isInsufficientBalance &&
      !isNFT &&
      showReviewControl &&
      isBuySupported &&
      !(isWatchingWallet && !platformEnv.isDev),
    [
      isInsufficientBalance,
      isNFT,
      showReviewControl,
      isBuySupported,
      isWatchingWallet,
    ],
  );
  const [isBuyLoading, setIsBuyLoading] = useState(false);
  const handleBuyToken = useCallback(async () => {
    setIsBuyLoading(true);
    try {
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId,
          tokenAddress: tokenInfo?.address ?? '',
          accountId: currentAccountId,
          type: 'buy',
        });
      if (url) {
        if (platformEnv.isDesktop || platformEnv.isNative) {
          openFiatCryptoUrl(url);
        } else {
          openUrlExternal(url);
        }
      }
    } finally {
      setIsBuyLoading(false);
    }
  }, [networkId, tokenInfo?.address, currentAccountId]);

  const onSelectPercentageStage = useCallback(
    (stage: number) => {
      const balance = isUseFiat ? maxBalanceFiat : maxBalance;
      let decimals = tokenDetails?.info.decimals;
      if (isUseFiat) {
        decimals = 6;
      } else if (isIntegerAmount) {
        decimals = 0;
      } else if (isLightningNetwork && lnUnit === ELightningUnit.BTC) {
        decimals = chainValueUtils.getLightningAmountDecimals({
          lnUnit,
          decimals: decimals ?? 8,
        });
      }
      const result = calcPercentBalance({
        balance,
        percent: stage,
        decimals,
        compactResult: true,
      });
      form.setValue('amount', result, { shouldValidate: true });
      setIsMaxSend(stage === 100);
    },
    [
      form,
      isIntegerAmount,
      isLightningNetwork,
      isUseFiat,
      lnUnit,
      maxBalance,
      maxBalanceFiat,
      tokenDetails?.info.decimals,
    ],
  );

  const displayCoinControlButton = useMemo(
    () => !!vaultSettings?.coinControlEnabled,
    [vaultSettings?.coinControlEnabled],
  );

  const handleCoinControlPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.CoinControl,
      params: {
        accountId: currentAccountId,
        networkId,
      },
    });
  }, [navigation, currentAccountId, networkId]);

  const normalizeAmountInputValue = useCallback(
    (rawValue: string) => {
      let inputValue = (rawValue ?? '').replace(/\s/g, '');

      if (inputValue.startsWith('.')) {
        inputValue = `0${inputValue}`;
      }

      if (
        inputValue.length > 1 &&
        inputValue.startsWith('0') &&
        !inputValue.startsWith('0.')
      ) {
        inputValue = inputValue.replace(/^0+/, '') || '0';
        if (inputValue.startsWith('.')) {
          inputValue = `0${inputValue}`;
        }
      }

      let filteredValue = inputValue.replace(/[^\d.]/g, '');
      const parts = filteredValue.split('.');
      if (parts.length > 2) {
        filteredValue = `${parts[0]}.${parts.slice(1).join('')}`;
      }
      inputValue = filteredValue;

      const hadUserInput = (rawValue ?? '').trim().length > 0;
      if (!inputValue && hadUserInput) {
        return '0';
      }

      const valueBN = new BigNumber(inputValue || 0);
      if (valueBN.isNaN()) {
        return '0';
      }

      if (isIntegerAmount) {
        return valueBN.toFixed(0);
      }

      if (!isUseFiat) {
        let decimals = tokenDetails?.info.decimals ?? 8;
        if (isLightningNetwork && lnUnit === ELightningUnit.BTC) {
          decimals = chainValueUtils.getLightningAmountDecimals({
            lnUnit,
            decimals,
          });
        }

        const decimalPlaces = valueBN.decimalPlaces();
        if (decimalPlaces && decimalPlaces > decimals) {
          return valueBN.toFixed(decimals, BigNumber.ROUND_FLOOR);
        }
      }

      return inputValue;
    },
    [
      isIntegerAmount,
      isLightningNetwork,
      isUseFiat,
      lnUnit,
      tokenDetails?.info.decimals,
    ],
  );

  const handleAmountInputChange = useCallback(
    (e: { target: { name: string; value: string } }) => {
      setIsMaxSend(false);
      const rawInputValue = e.target?.value ?? '';
      const normalizedInputValue = normalizeAmountInputValue(rawInputValue);
      if (normalizedInputValue !== rawInputValue) {
        form.setValue('amount', normalizedInputValue);
      }
    },
    [form, normalizeAmountInputValue],
  );

  // Track if amount input is focused
  const [isAmountInputFocused, setIsAmountInputFocused] = useState(false);

  // Ref for AmountInput to trigger button focus
  const amountInputRef = useRef<ISendAmountAutoSizeInputRef>(null);

  // Ref to track submit disabled state for keyboard shortcuts
  const isSubmitDisabledRef = useRef(true);

  // Auto-focus the amount input after page transition animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const currentSelectedUtxoKeys = currentSelectedUtxoInfo?.keys;
  const currentUtxoSelectionStrategy = currentSelectedUtxoInfo?.strategy;

  // Handle hex data for EVM chains
  const isHexTxMessage = useMemo(() => {
    if (!txMessage) return false;
    return hexUtils.isHexString(txMessage);
  }, [txMessage]);

  const txMessageLinkedString = useMemo(() => {
    if (!txMessage) return '';
    if (isHexTxMessage) return txMessage;
    return hexUtils.hexlify(Buffer.from(txMessage, 'utf-8'));
  }, [isHexTxMessage, txMessage]);

  const displayTxMessageForm = useMemo(() => {
    if (!tokenInfo?.isNative) return false;
    return settings.isCustomTxMessageEnabled && !!vaultSettings?.withTxMessage;
  }, [
    settings.isCustomTxMessageEnabled,
    tokenInfo?.isNative,
    vaultSettings?.withTxMessage,
  ]);

  const validateTxMessage = useCallback(
    (value: string) => {
      if (!value) return true;
      if (recipientIsContract && !hexUtils.isHexString(value)) {
        return intl.formatMessage({
          id: ETranslations.message_signing_message_invalid_hex,
        });
      }
      return true;
    },
    [intl, recipientIsContract],
  );

  const txMessageDescription = useMemo(() => {
    if (recipientIsContract) return '';
    if (!txMessage) return '';
    return intl.formatMessage(
      { id: ETranslations.current_input_format__desc },
      {
        format: isHexTxMessage
          ? intl.formatMessage({ id: ETranslations.raw_data__title })
          : 'UTF-8',
      },
    );
  }, [intl, isHexTxMessage, recipientIsContract, txMessage]);

  const txMessageViewActionLabel = useMemo(() => {
    if (!txMessage) return '';
    return intl.formatMessage(
      { id: ETranslations.view_format__action },
      {
        format: isHexTxMessage
          ? 'UTF-8'
          : intl.formatMessage({ id: ETranslations.raw_data__title }),
      },
    );
  }, [intl, isHexTxMessage, txMessage]);

  const showTxMessageRawData = useCallback(() => {
    if (!txMessage) return;
    let content = txMessageLinkedString;
    if (isHexTxMessage) {
      try {
        content = Buffer.from(txMessage.replace(/^0x/i, ''), 'hex').toString(
          'utf-8',
        );
      } catch {
        content = txMessageLinkedString;
      }
    }
    Dialog.show({
      title: txMessageViewActionLabel,
      renderContent: (
        <ScrollView maxHeight="$96">
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            selectable
            style={
              platformEnv.isNative ? undefined : { wordBreak: 'break-all' }
            }
          >
            {content}
          </SizableText>
        </ScrollView>
      ),
      showCancelButton: false,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_ok }),
    });
  }, [
    intl,
    isHexTxMessage,
    txMessage,
    txMessageLinkedString,
    txMessageViewActionLabel,
  ]);

  const showTxMessageFaq = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: recipientIsContract
          ? ETranslations.global_hex_data_default
          : ETranslations.global_hex_data,
      }),
      icon: 'ConsoleOutline',
      description: intl.formatMessage({
        id: ETranslations.global_hex_data_faq_desc,
      }),
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_ok,
      }),
    });
  }, [intl, recipientIsContract]);

  const getRecipientValidateMessage = useCallback(
    (status?: Exclude<IAddressValidateStatus, 'valid'>) => {
      if (!status) return;
      const message: Record<
        Exclude<IAddressValidateStatus, 'valid'>,
        ETranslations
      > = {
        unknown: ETranslations.send_check_request_error,
        'prohibit-send-to-self': ETranslations.send_cannot_send_to_self,
        invalid: ETranslations.send_address_invalid,
        'address-not-allowlist': ETranslations.send_address_not_allowlist_error,
      };
      return message[status];
    },
    [],
  );

  const validateRecipientBeforeSubmit = useCallback(async () => {
    if (!recipientAddress) {
      return undefined;
    }

    const queryResult =
      await backgroundApiProxy.serviceAccountProfile.queryAddress({
        networkId,
        accountId: currentAccountId,
        address: recipientAddress,
        enableAddressBook: true,
        enableAddressContract: true,
        enableVerifySendFundToSelf: true,
        enableWalletName: true,
        enableAllowListValidation,
        ignoreSimilarAddressInAddressBook: true,
        enableCheckSimilarAddressInAddressBook: true,
      });

    const validationStatus = queryResult.validStatus ?? 'unknown';
    if (validationStatus !== 'valid') {
      const translationId = getRecipientValidateMessage(validationStatus);
      throw new OneKeyLocalError({
        key: translationId,
        message: translationId
          ? intl.formatMessage({ id: translationId })
          : undefined,
      });
    }

    const resolvedRecipientAddress =
      queryResult.resolveAddress ??
      queryResult.validAddress ??
      recipientAddress;

    if (queryResult.similarAddress) {
      try {
        await showSimilarAddressDialog({
          similarAddress: queryResult.similarAddress,
          currentAddress: resolvedRecipientAddress,
        });
      } catch {
        return undefined;
      }
    }

    return {
      recipientAddress: resolvedRecipientAddress,
      recipientIsContract:
        queryResult.isContract ?? recipientIsContract ?? false,
    };
  }, [
    currentAccountId,
    enableAllowListValidation,
    getRecipientValidateMessage,
    intl,
    networkId,
    recipientAddress,
    recipientIsContract,
  ]);

  onSubmitRef.current = useCallback(
    async () =>
      errorToastUtils.withErrorAutoToast(async () => {
        setIsSubmitting(true);
        try {
          if (!account) return;

          let realAmount = amount;

          const recipientValidation = await validateRecipientBeforeSubmit();
          if (!recipientValidation) {
            return;
          }

          const submitRecipientAddress = recipientValidation.recipientAddress;
          const submitRecipientIsContract =
            recipientValidation.recipientIsContract;

          if (isNFT) {
            realAmount = nftAmount;
          } else {
            realAmount = amount;

            if (isUseFiat) {
              if (
                new BigNumber(amount).isGreaterThan(
                  tokenDetails?.fiatValue ?? 0,
                )
              ) {
                // balanceParsed is in sats for Lightning. Convert to BTC
                // when lnUnit=BTC so the downstream convertBtcToSats is correct.
                const balance = tokenDetails?.balanceParsed ?? '0';
                realAmount =
                  isLightningNetwork && lnUnit === ELightningUnit.BTC
                    ? chainValueUtils.convertSatsToBtc(balance)
                    : balance;
              } else {
                realAmount = linkedAmount.originalAmount;
              }
            }
          }

          if (isLightningNetwork && lnUnit === ELightningUnit.BTC) {
            realAmount = chainValueUtils.convertBtcToSats(realAmount);
          }

          const txMessageValue = form.getValues('txMessage');
          if (
            submitRecipientIsContract &&
            txMessageValue &&
            !hexUtils.isHexString(txMessageValue)
          ) {
            const txMessageValidationResult = intl.formatMessage({
              id: ETranslations.message_signing_message_invalid_hex,
            });
            if (txMessageValidationResult) {
              throw new OneKeyLocalError({
                key: ETranslations.message_signing_message_invalid_hex,
                message: txMessageValidationResult,
              });
            }
          }
          const hexData = isHexTxMessage
            ? txMessageValue
            : txMessageLinkedString;

          const transfersInfo: ITransferInfo[] = [
            {
              from: account.address,
              to: submitRecipientAddress,
              amount: realAmount,
              nftInfo:
                isNFT && nftDetails
                  ? {
                      nftId: nftDetails.itemId,
                      nftAddress: nftDetails.collectionAddress,
                      nftType: nftDetails.collectionType,
                    }
                  : undefined,
              tokenInfo: !isNFT && tokenDetails ? tokenDetails.info : undefined,
              memo: recipientMemo,
              paymentId: recipientPaymentId,
              note: recipientNote,
              hexData: tokenDetails?.info.isNative ? hexData : undefined,
              selectedUtxoKeys: currentSelectedUtxoKeys,
              utxoSelectionStrategy: currentUtxoSelectionStrategy,
            },
          ];

          defaultLogger.transaction.send.amountInput({
            tokenType: isNFT ? 'NFT' : 'Token',
            tokenSymbol: isNFT
              ? nft?.metadata?.name
              : tokenDetails?.info.symbol,
            tokenAddress: isNFT
              ? `${nft?.collectionAddress ?? ''}:${nft?.itemId ?? ''}`
              : tokenInfo?.address,
          });

          await signatureConfirm.navigationToTxConfirm({
            transfersInfo,
            sameModal: true,
            onSuccess,
            onFail,
            onCancel,
            transferPayload: {
              amountToSend: realAmount,
              isMaxSend,
              isNFT,
              originalRecipient: submitRecipientAddress,
              isToContract: submitRecipientIsContract,
              memo: recipientMemo,
              paymentId: recipientPaymentId,
              note: recipientNote,
              tokenInfo: tokenDetails?.info,
              isCustomHexData: !!(
                submitRecipientIsContract &&
                settings.isCustomTxMessageEnabled &&
                displayTxMessageForm &&
                tokenInfo?.isNative &&
                !isEmpty(hexData)
              ),
            },
            isInternalTransfer: true,
          });
        } finally {
          setIsSubmitting(false);
        }
      }),
    [
      account,
      amount,
      currentSelectedUtxoKeys,
      currentUtxoSelectionStrategy,
      displayTxMessageForm,
      form,
      isHexTxMessage,
      isLightningNetwork,
      isMaxSend,
      isNFT,
      isUseFiat,
      linkedAmount.originalAmount,
      lnUnit,
      nft?.collectionAddress,
      nft?.itemId,
      nft?.metadata?.name,
      nftAmount,
      nftDetails,
      onCancel,
      onFail,
      onSuccess,
      recipientMemo,
      recipientNote,
      recipientPaymentId,
      settings.isCustomTxMessageEnabled,
      signatureConfirm,
      tokenDetails,
      tokenInfo?.address,
      tokenInfo?.isNative,
      txMessageLinkedString,
      validateRecipientBeforeSubmit,
      intl,
    ],
  );

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (!form.formState.isValid) return true;
    if (!recipientAddress) return true;
    if (isInsufficientBalance) return true;
    if (isNFT) {
      if (nft?.collectionType === ENFTType.ERC1155) {
        return !nftAmount || new BigNumber(nftAmount).isLessThanOrEqualTo(0);
      }
      return false;
    }
    if (!amount) return true;
    if (
      amount === '0' &&
      !(tokenInfo?.isNative && vaultSettings?.transferZeroNativeTokenEnabled)
    ) {
      return true;
    }
    return false;
  }, [
    isSubmitting,
    form.formState.isValid,
    recipientAddress,
    isInsufficientBalance,
    isNFT,
    nft?.collectionType,
    nftAmount,
    tokenInfo?.isNative,
    vaultSettings?.transferZeroNativeTokenEnabled,
    amount,
  ]);

  // Keep ref in sync with isSubmitDisabled
  isSubmitDisabledRef.current = isSubmitDisabled;

  const handleConfirm = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    await onSubmitRef.current?.();
  }, [form]);

  // Keyboard shortcuts for desktop (when input is not focused)
  // M = Max, Enter = confirm
  useEffect(() => {
    if (platformEnv.isNative || isNFT) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if input is focused or if modifier keys are pressed
      if (isAmountInputFocused || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onSelectPercentageStage(100);
        return;
      }

      if (e.key === 'Enter' && !isSubmitDisabledRef.current) {
        e.preventDefault();
        void handleConfirm();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirm, isAmountInputFocused, isNFT, onSelectPercentageStage]);

  const balanceInfoContent = useMemo(() => {
    if (!hasFrozenBalance) return null;
    return (
      <XStack
        ml="$2"
        p="$0.5"
        onPress={() => {
          showBalanceDetailsDialog({
            accountId: currentAccountId,
            networkId,
            mergeDeriveAssetsEnabled: false,
            intl,
          });
        }}
        hoverStyle={{ opacity: 0.7 }}
        pressStyle={{ opacity: 0.5 }}
        cursor="pointer"
      >
        <Icon name="InfoCircleOutline" size="$4.5" color="$iconSubdued" />
      </XStack>
    );
  }, [hasFrozenBalance, currentAccountId, networkId, intl]);

  const extraContent = useMemo(() => {
    const addons: React.ReactNode[] = [];

    if (vaultSettings?.mergeDeriveAssetsEnabled) {
      addons.push(
        <AddressTypeSelector
          key="address-type-selector"
          placement="top-end"
          walletId={walletId}
          networkId={networkId}
          indexedAccountId={account?.indexedAccountId ?? ''}
          activeDeriveInfo={deriveInfo}
          activeDeriveType={deriveType}
          // Use refreshOnOpen so each derive type fetches its own balance.
          // Do NOT pass tokenMap here — the global map only contains the
          // currently selected derive type and would show wrong balances
          // for other types (e.g. Taproot).
          refreshOnOpen
          onSelect={async ({ account: a }) => {
            if (a) {
              setCurrentAccountId(a.id);
              sendConfirmActions.current.clearSelectedUTXOs();
            }
          }}
        />,
      );
    }

    if (displayCoinControlButton) {
      addons.push(
        <CoinControlBadge
          key="coin-control"
          onPress={handleCoinControlPress}
        />,
      );
    }

    if (!addons.length) return null;

    return (
      <XStack
        gap="$2"
        alignItems="center"
        justifyContent="flex-start"
        flexWrap="wrap"
        width="100%"
        mt="$4"
      >
        {addons}
      </XStack>
    );
  }, [
    account?.indexedAccountId,
    deriveInfo,
    deriveType,
    displayCoinControlButton,
    handleCoinControlPress,
    networkId,
    sendConfirmActions,
    vaultSettings?.mergeDeriveAssetsEnabled,
    walletId,
  ]);

  const isAmountZeroOrEmpty = !amount || new BigNumber(amount).isZero();
  const amountHint =
    isAmountZeroOrEmpty || !hasAmountError ? minAmountHint : undefined;

  const renderAmountInput = useMemo(
    () => (
      <>
        <Form.Field
          name="amount"
          errorMessageAlign="center"
          hint={amountHint}
          rules={{
            required: true,
            validate: handleValidateTokenAmount,
            onChange: handleAmountInputChange,
          }}
        >
          <SendAutoSizeAmountInput
            ref={amountInputRef}
            tokenSymbol={isUseFiat ? undefined : tokenSymbol}
            reversible={!isInvoiceAmountLocked}
            valueProps={{
              currency: isUseFiat ? undefined : currencySymbol,
              tokenSymbol: isUseFiat ? tokenSymbol : undefined,
              value: isUseFiat
                ? linkedAmount.originalAmount
                : linkedAmount.linkedAmount,
              onPress: handleToggleFiatMode,
            }}
            inputProps={{
              inputAccessoryViewID: platformEnv.isNativeIOS
                ? amountInputAccessoryViewID
                : undefined,
              placeholder: '0',
              editable: !isInvoiceAmountLocked,
              onFocus: () => {
                setIsAmountInputFocused(true);
              },
              onBlur: () => {
                setIsAmountInputFocused(false);
              },
              keyboardType: isIntegerAmount ? 'number-pad' : 'decimal-pad',
              ...(isUseFiat && {
                leftAddOnProps: {
                  label: currencySymbol,
                  pr: '$0',
                  pl: '$0',
                  mr: '$-2',
                },
              }),
            }}
          />
        </Form.Field>
        {platformEnv.isNativeIOS ? (
          <InputAccessoryView nativeID={amountInputAccessoryViewID}>
            <SizableText h="$0" />
          </InputAccessoryView>
        ) : null}
      </>
    ),
    [
      amountHint,
      currencySymbol,
      handleAmountInputChange,
      handleToggleFiatMode,
      handleValidateTokenAmount,
      isIntegerAmount,
      isInvoiceAmountLocked,
      isUseFiat,
      linkedAmount.linkedAmount,
      linkedAmount.originalAmount,
      tokenSymbol,
    ],
  );

  const renderNFTAmountInput = useMemo(() => {
    if (!isNFT || nft?.collectionType !== ENFTType.ERC1155) return null;

    return (
      <Form.Field
        name="nftAmount"
        errorMessageAlign="center"
        rules={{
          required: true,
          max: nftDetails?.amount ?? 1,
          min: 1,
          onChange: (e: { target: { name: string; value: string } }) => {
            const valueString = new BigNumber(e.target?.value).toFixed();
            if (/^[1-9]\d*$/.test(valueString)) {
              form.setValue('nftAmount', valueString);
            } else {
              form.setValue('nftAmount', '');
            }
          },
        }}
      >
        <SendAutoSizeAmountInput
          tokenSymbol={nft?.metadata?.name ?? nft?.collectionName}
          inputProps={{
            placeholder: '0',
            keyboardType: 'number-pad',
          }}
        />
      </Form.Field>
    );
  }, [
    form,
    isNFT,
    nft?.collectionName,
    nft?.collectionType,
    nft?.metadata?.name,
    nftDetails?.amount,
  ]);

  const renderNFTInfoCard = useMemo(() => {
    if (!isNFT) return null;
    const nftImage = nft?.metadata?.image;
    const nftName = nft?.metadata?.name ?? nft?.collectionName ?? '';
    return (
      <XStack
        bg="$bgStrong"
        borderRadius="$3"
        px="$3"
        py="$2.5"
        alignItems="center"
        width="100%"
      >
        <Stack mr="$3">
          {nftImage ? (
            <Image size="$10" borderRadius="$2" source={{ uri: nftImage }} />
          ) : (
            <Stack
              w="$10"
              h="$10"
              borderRadius="$2"
              bg="$gray5"
              alignItems="center"
              justifyContent="center"
            >
              <Icon name="ImageMountainSolid" size="$6" color="$iconSubdued" />
            </Stack>
          )}
        </Stack>
        <YStack flex={1}>
          <SizableText size="$bodySm" color="$textSubdued">
            {nftName}
          </SizableText>
          {nft?.collectionType === ENFTType.ERC1155 ? (
            <XStack alignItems="center" mt="$0.5">
              <SizableText size="$bodyLgMedium" color="$text">
                {nftDetails?.amount ?? 1}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>

        {nft?.collectionType === ENFTType.ERC1155 ? (
          <Button
            variant="secondary"
            size="small"
            ml="$2"
            onPress={() => {
              form.setValue('nftAmount', nftDetails?.amount ?? '1', {
                shouldValidate: true,
              });
            }}
          >
            {intl.formatMessage({ id: ETranslations.send_max })}
          </Button>
        ) : null}
      </XStack>
    );
  }, [
    form,
    intl,
    isNFT,
    nft?.collectionName,
    nft?.collectionType,
    nft?.metadata?.image,
    nft?.metadata?.name,
    nftDetails?.amount,
  ]);

  const renderBalanceCard = useMemo(() => {
    if (isNFT) return null;

    if (isLoadingAssets) {
      return (
        <XStack
          bg="$bgStrong"
          borderRadius="$3"
          px="$3"
          py="$2.5"
          alignItems="center"
          width="100%"
        >
          <Skeleton w="$10" h="$10" radius="round" mr="$3" />
          <YStack flex={1} gap="$1.5">
            <Skeleton h="$3" w="$10" />
            <Skeleton h="$4" w="$24" />
          </YStack>
        </XStack>
      );
    }

    if (!maxBalance) return null;

    return (
      <XStack
        bg="$bgStrong"
        borderRadius="$3"
        px="$3"
        py="$2.5"
        alignItems="center"
        width="100%"
      >
        {/* Token icon with network badge */}
        <Stack mr="$3">
          {tokenInfo?.logoURI ? (
            <Stack>
              <Image
                size="$10"
                borderRadius="$full"
                source={{ uri: tokenInfo.logoURI }}
              />
              {network?.logoURI ? (
                <Stack
                  position="absolute"
                  right="$-0.5"
                  bottom="$-0.5"
                  p="$px"
                  borderRadius="$full"
                  bg="$bgStrong"
                >
                  <Image
                    size="$4"
                    borderRadius="$full"
                    source={{ uri: network.logoURI }}
                  />
                </Stack>
              ) : null}
            </Stack>
          ) : (
            <Stack
              w="$10"
              h="$10"
              borderRadius="$full"
              bg="$gray5"
              alignItems="center"
              justifyContent="center"
            >
              <Icon name="CryptoCoinOutline" size="$6" color="$iconSubdued" />
            </Stack>
          )}
        </Stack>

        {/* Balance label + amount */}
        <YStack flex={1}>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_available })}
          </SizableText>
          <XStack alignItems="center" mt="$0.5">
            <NumberSizeableText
              size="$bodyLgMedium"
              color="$text"
              formatter="balance"
            >
              {maxBalance}
            </NumberSizeableText>
            {tokenSymbol ? (
              <SizableText
                size="$bodyLgMedium"
                color="$text"
                ml="$1"
                numberOfLines={1}
                flexShrink={1}
              >
                {tokenSymbol}
              </SizableText>
            ) : null}
            {balanceInfoContent}
          </XStack>
        </YStack>

        {/* Max button */}
        <Button
          variant="secondary"
          size="small"
          ml="$2"
          onPress={() => {
            form.setValue('amount', isUseFiat ? maxBalanceFiat : maxBalance, {
              shouldValidate: true,
            });
            setIsMaxSend(true);
          }}
        >
          {intl.formatMessage({ id: ETranslations.send_max })}
        </Button>
      </XStack>
    );
  }, [
    balanceInfoContent,
    form,
    intl,
    isLoadingAssets,
    isNFT,
    isUseFiat,
    maxBalance,
    maxBalanceFiat,
    network?.logoURI,
    tokenInfo?.logoURI,
    tokenSymbol,
  ]);

  return (
    <Page safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.enter_amount__title })}
      />

      <Page.Body px="$5" justifyContent="center">
        <Form form={form}>
          {isNFT ? renderNFTAmountInput : renderAmountInput}

          {isLightningNetwork && lnUnit ? (
            <XStack justifyContent="center" mt="$2">
              <LightningUnitSwitch
                value={lnUnit}
                onChange={(v) => {
                  setLnUnit(v as ELightningUnit);
                  if (!isUseFiat) {
                    form.setValue(
                      'amount',
                      v === ELightningUnit.BTC
                        ? chainValueUtils.convertSatsToBtc(
                            form.getValues('amount'),
                          )
                        : chainValueUtils.convertBtcToSats(
                            form.getValues('amount'),
                          ),
                    );
                    if (form.formState.isDirty) {
                      setTimeout(() => {
                        void form.trigger('amount');
                      }, 100);
                    }
                  }
                }}
              />
            </XStack>
          ) : null}
        </Form>
      </Page.Body>

      <Page.Footer>
        <Stack px="$5" gap="$3">
          <HeightTransition hide={!displayTxMessageForm}>
            <Form form={form}>
              <Form.Field
                name="txMessage"
                label={intl.formatMessage({
                  id: recipientIsContract
                    ? ETranslations.global_contract_call
                    : ETranslations.global_hex_data,
                })}
                optional
                rules={{
                  validate: validateTxMessage,
                }}
                description={
                  txMessageDescription ? (
                    <SizableText size="$bodySm" color="$textSubdued">
                      {`${txMessageDescription} `}
                      <SizableText
                        size="$bodySm"
                        color="$textSubdued"
                        textDecorationLine="underline"
                        onPress={showTxMessageRawData}
                      >
                        {txMessageViewActionLabel}
                      </SizableText>
                    </SizableText>
                  ) : undefined
                }
                labelAddon={
                  <Button
                    size="small"
                    variant="tertiary"
                    onPress={showTxMessageFaq}
                  >
                    {intl.formatMessage({
                      id: recipientIsContract
                        ? ETranslations.global_hex_data_default_faq
                        : ETranslations.global_hex_data_faq,
                    })}
                  </Button>
                }
              >
                <TextArea>
                  <TextAreaInput
                    placeholder={intl.formatMessage({
                      id: recipientIsContract
                        ? ETranslations.global_hex_data_default
                        : ETranslations.global_hex_data_input_default,
                    })}
                  />
                </TextArea>
              </Form.Field>
            </Form>
          </HeightTransition>
          {extraContent}
          {renderBalanceCard}
          {renderNFTInfoCard}
        </Stack>
        {showBuyButton ? (
          <Page.FooterActions
            confirmButton={
              <XStack gap="$2.5" flex={1}>
                <Button
                  variant="primary"
                  onPress={handleBuyToken}
                  loading={isBuyLoading}
                  flexGrow={1}
                  flexShrink={1}
                  $md={
                    {
                      size: 'large',
                    } as any
                  }
                >
                  {`${intl.formatMessage({
                    id: ETranslations.global_buy,
                  })} ${tokenSymbol}`}
                </Button>
                <Button
                  disabled
                  flexGrow={1}
                  flexShrink={1}
                  $md={
                    {
                      size: 'large',
                    } as any
                  }
                >
                  {intl.formatMessage({
                    id: ETranslations.insufficient_funds__action,
                  })}
                </Button>
              </XStack>
            }
          />
        ) : (
          <Page.FooterActions
            onConfirm={handleConfirm}
            onConfirmText={
              isInsufficientBalance
                ? intl.formatMessage({
                    id: ETranslations.insufficient_funds__action,
                  })
                : intl.formatMessage({
                    id: ETranslations.send_preview_button,
                  })
            }
            confirmButtonProps={{
              disabled: isSubmitDisabled,
              loading: isSubmitting,
            }}
          />
        )}
      </Page.Footer>
    </Page>
  );
}

const SendAmountInputContainerWithProvider = memo(() => (
  <SendConfirmProviderMirror>
    <HomeTokenListProviderMirror>
      <SendAmountInputContainer />
    </HomeTokenListProviderMirror>
  </SendConfirmProviderMirror>
));
SendAmountInputContainerWithProvider.displayName =
  'SendAmountInputContainerWithProvider';

export default SendAmountInputContainerWithProvider;
