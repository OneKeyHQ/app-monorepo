import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import type { IPageNavigationProp, useInTabDialog } from '@onekeyhq/components';
import {
  Button,
  DashText,
  Dialog,
  Icon,
  IconButton,
  Image,
  NavBackButton,
  Page,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { PageHeader } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import { isAccountIdDeactivatedBotWallet } from '@onekeyhq/kit/src/utils/botWalletAccountUtils';
import { showBotWalletDeactivatedWarningDialog } from '@onekeyhq/kit/src/utils/botWalletWarningDialog';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  type ISendAmountAutoSizeInputRef,
  SendAutoSizeAmountInput,
} from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { resolvePerpsDepositSelectedToken } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/utils/depositTokenListUtils';
import type {
  IPerpsActiveAccountAtom,
  IPerpsDepositToken,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  perpsActiveAccountAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsComputedAccountValueAtom,
  usePerpsDepositTokensAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes/receive';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  USDC_TOKEN_INFO,
  WITHDRAW_FEE,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNativeTokenConfig } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import usePerpDeposit from '../../../hooks/usePerpDeposit';
import { PerpsAccountSelectorProviderMirror } from '../../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { preloadPerpsDepositSelectTokenModal } from '../../../utils/preloadPerpsDepositSelectTokenModal';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../../PerpDialogLayout';
import { InputAccessoryDoneButton } from '../inputs/TradingFormInput';

import {
  arePerpsDepositSelectedTokenRefreshFieldsEqual,
  getPerpsDepositMinimumCheck,
  getPerpsDepositTokenDisplayList,
  getPerpsDepositTokensIdentityKey,
  getPerpsDepositTokensWithDefaultFallback,
  mergePerpsDepositTokensPreservingOrder,
  shouldPreservePerpsDepositSelectedToken,
  shouldShowPerpsDepositTokenSkeleton,
} from './depositTokenDisplayUtils';
import { DepositTokenSelectionContent } from './DepositTokenSelectionContent';

import type { RouteProp } from '@react-navigation/native';
import type { IntlShape } from 'react-intl';

export type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

const DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID =
  'perp-deposit-withdraw-accessory-view';
const PERP_DESKTOP_DEPOSIT_WITHDRAW_DIALOG_HEIGHT = 560;
const PERP_DESKTOP_DEPOSIT_AMOUNT_INPUT_BLOCK_HEIGHT = 220;
const PERP_ANDROID_DEPOSIT_AMOUNT_INPUT_BLOCK_HEIGHT = 176;
const PERP_DESKTOP_DEPOSIT_SELECT_TOKEN_LIST_HEIGHT = 430;
const PERP_NATIVE_DEPOSIT_WITHDRAW_ESTIMATED_CONTENT_HEIGHT = 300;
const LIFI_FALLBACK_LOGO = require('@onekeyhq/kit/assets/perps/lifi-logo.png');

function hasPositivePerpsDepositTokenAmount(tokenAmount?: string) {
  if (!tokenAmount) {
    return false;
  }
  const amountBN = new BigNumber(tokenAmount);
  return !amountBN.isNaN() && amountBN.gt(0);
}

function shouldWaitForPerpsDepositQuoteDebounce({
  selectedAction,
  isArbitrumUsdcToken,
  canQuoteDepositAmount,
  tokenAmount,
  debouncedTokenAmount,
}: {
  selectedAction: IPerpsDepositWithdrawActionType;
  isArbitrumUsdcToken: boolean;
  canQuoteDepositAmount: boolean;
  tokenAmount: string;
  debouncedTokenAmount: string;
}) {
  return (
    selectedAction === 'deposit' &&
    !isArbitrumUsdcToken &&
    canQuoteDepositAmount &&
    hasPositivePerpsDepositTokenAmount(tokenAmount) &&
    tokenAmount !== debouncedTokenAmount
  );
}

function getPerpsDepositMinAmountTextColor(
  selectedAction: IPerpsDepositWithdrawActionType,
) {
  return selectedAction === 'deposit' ? '$textCritical' : '$textSubdued';
}

interface IDepositWithdrawParams {
  actionType: IPerpsDepositWithdrawActionType;
}

interface IDepositWithdrawContentProps {
  params: IDepositWithdrawParams;
  selectedAccount: IPerpsActiveAccountAtom;
  onClose?: () => void;
  isMobile?: boolean;
  hideDesktopTitle?: boolean;
}

const CUSTOM_AMOUNT_KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

const PERPS_KEYPAD_KEY_INTERACTIVE_STYLE = {
  opacity: 1,
  bg: '$bgStrong',
} as const;

// Perps is USD-denominated; always show dollar sign regardless of system fiat setting
const PERPS_CURRENCY_SYMBOL = '$';

function getDepositWithdrawAmountInputMinHeight(isMobile?: boolean) {
  if (!isMobile) {
    return PERP_DESKTOP_DEPOSIT_AMOUNT_INPUT_BLOCK_HEIGHT;
  }
  if (platformEnv.isNativeAndroid) {
    return PERP_ANDROID_DEPOSIT_AMOUNT_INPUT_BLOCK_HEIGHT;
  }
  return undefined;
}

function getDepositWithdrawTitle(
  actionType: IPerpsDepositWithdrawActionType,
  intl: IntlShape,
) {
  return intl.formatMessage({
    id:
      actionType === 'deposit'
        ? ETranslations.perp_trade_deposit
        : ETranslations.perp_trade_withdraw,
  });
}

function usePerpsAccountResult(selectedAccount: IPerpsActiveAccountAtom) {
  const { serviceAccount } = backgroundApiProxy;

  const { result: accountResult } = usePromiseResult(async () => {
    const isOtherAccount = accountUtils.isOthersAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    let indexedAccount: IDBIndexedAccount | undefined;
    let account: INetworkAccount | undefined;
    const wallet = await serviceAccount.getWalletSafe({
      walletId: accountUtils.getWalletIdFromAccountId({
        accountId: selectedAccount.accountId ?? '',
      }),
    });
    if (isOtherAccount && selectedAccount.accountId) {
      account = await serviceAccount.getAccount({
        accountId: selectedAccount.accountId,
        networkId: PERPS_NETWORK_ID,
      });
    } else if (selectedAccount.indexedAccountId) {
      indexedAccount = await serviceAccount.getIndexedAccount({
        id: selectedAccount.indexedAccountId,
      });
    }

    return { wallet, account, indexedAccount, isOtherAccount };
  }, [
    selectedAccount.indexedAccountId,
    selectedAccount.accountId,
    serviceAccount,
  ]);

  return accountResult;
}

function PerpsNativeAmountKeypad({
  onKeyPress,
  onBackspaceLongPress,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onCtaPress,
}: {
  onKeyPress: (key: string) => void;
  onBackspaceLongPress: () => void;
  ctaLabel: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onCtaPress: () => void;
}) {
  return (
    <YStack mt="$2" gap="$2" pb={platformEnv.isNativeAndroid ? '$3' : '$0'}>
      {CUSTOM_AMOUNT_KEYPAD_ROWS.map((row) => (
        <XStack key={row.join('-')} gap="$2">
          {row.map((item) => (
            <Stack
              key={item}
              flex={1}
              h="$14"
              alignItems="center"
              justifyContent="center"
              borderRadius="$2.5"
              pressStyle={PERPS_KEYPAD_KEY_INTERACTIVE_STYLE}
              hoverStyle={PERPS_KEYPAD_KEY_INTERACTIVE_STYLE}
              onPress={() => onKeyPress(item)}
              onLongPress={
                item === 'backspace' ? onBackspaceLongPress : undefined
              }
            >
              {item === 'backspace' ? (
                <Icon name="XBackspaceOutline" size="$5" color="$iconSubdued" />
              ) : (
                <SizableText size="$heading2xl" fontWeight="400" color="$text">
                  {item}
                </SizableText>
              )}
            </Stack>
          ))}
        </XStack>
      ))}
      <Button
        testID="perp-native-amount-cta"
        size="large"
        variant="primary"
        disabled={ctaDisabled}
        loading={ctaLoading}
        onPress={onCtaPress}
      >
        {ctaLabel}
      </Button>
    </YStack>
  );
}

function DepositWithdrawContent({
  params,
  selectedAccount,
  onClose,
  isMobile,
  hideDesktopTitle,
}: IDepositWithdrawContentProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const selectedAction = params.actionType;
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const withdrawable = computedValue?.withdrawable ?? '';
  const [amount, setAmount] = useState('');
  const [depositInputUnit, setDepositInputUnit] = useState<'token' | 'usd'>(
    'usd',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinAmountError, setShowMinAmountError] = useState(false);
  const [desktopDepositPage, setDesktopDepositPage] = useState<
    'form' | 'selectToken'
  >('form');
  const amountInputRef = useRef<ISendAmountAutoSizeInputRef>(null);
  const [
    {
      tokens,
      defaultTokens,
      currentPerpsDepositSelectedToken,
      depositTokenListOwnerKey,
      depositTokenListRevision,
      depositTokenListSource,
    },
    setPerpsDepositTokensAtom,
  ] = usePerpsDepositTokensAtom();

  const cachedDepositTokens = useMemo(
    () => getPerpsDepositTokenDisplayList(tokens),
    [tokens],
  );
  const defaultTokenIdentitiesKey = useMemo(
    () => getPerpsDepositTokensIdentityKey(defaultTokens),
    [defaultTokens],
  );
  const defaultTokensRef = useRef(defaultTokens);
  defaultTokensRef.current = defaultTokens;
  const currentDepositTokenIdentity = useMemo(
    () =>
      currentPerpsDepositSelectedToken
        ? `${currentPerpsDepositSelectedToken.networkId ?? ''}::${
            currentPerpsDepositSelectedToken.contractAddress ??
            currentPerpsDepositSelectedToken.symbol ??
            ''
          }`
        : undefined,
    [currentPerpsDepositSelectedToken],
  );
  const currentPerpsDepositSelectedTokenRef = useRef<
    IPerpsDepositToken | undefined
  >(currentPerpsDepositSelectedToken);
  const previousDepositTokenIdentityRef = useRef<string | undefined>(undefined);
  const depositTokenRequestKey = useMemo(
    () =>
      [
        selectedAccount.accountId ?? '',
        selectedAccount.indexedAccountId ?? '',
        selectedAccount.accountAddress ?? '',
      ].join('::'),
    [
      selectedAccount.accountAddress,
      selectedAccount.accountId,
      selectedAccount.indexedAccountId,
    ],
  );
  const depositTokenRequestKeyRef = useRef(depositTokenRequestKey);
  depositTokenRequestKeyRef.current = depositTokenRequestKey;
  const depositTokenListOwnerKeyRef = useRef<string | undefined>(undefined);
  const lastSyncedDepositTokenListRevisionRef = useRef<number | undefined>(
    undefined,
  );

  const [depositTokensWithPrice, setDepositTokensWithPrice] = useState<
    IPerpsDepositToken[]
  >([]);
  const depositTokensWithPriceRef = useRef<IPerpsDepositToken[]>([]);
  depositTokensWithPriceRef.current = depositTokensWithPrice;
  const [hasLoadedDepositTokenBalances, setHasLoadedDepositTokenBalances] =
    useState(false);
  const [nativeTokenConfigs, setNativeTokenConfigs] = useState<
    ISwapNativeTokenConfig[]
  >([]);
  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;
  const navigation = useAppNavigation();
  const perpModalNavigation =
    useNavigation<IPageNavigationProp<IModalPerpParamList>>();

  const accountResult = usePerpsAccountResult(selectedAccount);

  const checkDepositWalletNotBackedUp = useCallback(async () => {
    const walletId =
      accountResult?.wallet?.id ??
      (selectedAccount.accountId
        ? accountUtils.getWalletIdFromAccountId({
            accountId: selectedAccount.accountId,
          })
        : undefined);
    if (!walletId) return false;

    return backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
      walletId,
    });
  }, [accountResult?.wallet?.id, selectedAccount.accountId]);

  const handleBuyPress = useCallback(async () => {
    if (!currentPerpsDepositSelectedToken || !accountResult) {
      return;
    }

    await dismissKeyboardWithDelay();
    if (await checkDepositWalletNotBackedUp()) {
      return;
    }

    defaultLogger.wallet.walletActions.buyOnLowBalance({
      source: 'perp',
      networkId: currentPerpsDepositSelectedToken.networkId ?? '',
      tokenSymbol: currentPerpsDepositSelectedToken.symbol ?? '',
      tokenAddress: currentPerpsDepositSelectedToken.contractAddress ?? '',
      walletType: accountResult.wallet?.type ?? '',
    });

    const navParams = {
      accountId: selectedAccount.accountId ?? '',
      networkId: currentPerpsDepositSelectedToken.networkId ?? '',
      walletId: accountResult.wallet?.id ?? '',
      indexedAccountId: selectedAccount.indexedAccountId,
      showSwapEntry: true,
      token: {
        networkId: currentPerpsDepositSelectedToken.networkId ?? '',
        address: currentPerpsDepositSelectedToken.contractAddress ?? '',
        name: currentPerpsDepositSelectedToken.name ?? '',
        symbol: currentPerpsDepositSelectedToken.symbol ?? '',
        decimals: currentPerpsDepositSelectedToken.decimals,
        logoURI: currentPerpsDepositSelectedToken.logoURI,
        isNative: currentPerpsDepositSelectedToken.isNative,
      },
    };

    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
      params: navParams,
    });
  }, [
    navigation,
    currentPerpsDepositSelectedToken,
    selectedAccount,
    accountResult,
    checkDepositWalletNotBackedUp,
  ]);

  const checkAccountSupport = useMemo(() => {
    const isWatchingAccount = accountUtils.isWatchingAccount({
      accountId: selectedAccount.accountId || '',
    });
    return !isWatchingAccount;
  }, [selectedAccount.accountId]);

  const syncDepositTokenBalances = useCallback(
    async ({
      depositTokens,
      requestKey,
      preserveCurrentOrder,
    }: {
      depositTokens: IPerpsDepositToken[];
      requestKey: string;
      preserveCurrentOrder?: boolean;
    }) => {
      const tokensToSync = preserveCurrentOrder
        ? mergePerpsDepositTokensPreservingOrder({
            currentTokens: depositTokensWithPriceRef.current,
            nextTokens: depositTokens,
          })
        : depositTokens;
      const nativeTokenNetworkIds = Array.from(
        new Set(
          tokensToSync
            .filter((token) => token.isNative)
            .map((token) => token.networkId),
        ),
      );
      const nativeTokenConfigsRes = (
        await Promise.all(
          nativeTokenNetworkIds.map((networkId) =>
            backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
              networkId,
            }),
          ),
        )
      ).filter((item): item is ISwapNativeTokenConfig => Boolean(item));
      if (depositTokenRequestKeyRef.current !== requestKey) {
        return false;
      }
      setNativeTokenConfigs(nativeTokenConfigsRes);
      setDepositTokensWithPrice(tokensToSync);
      setHasLoadedDepositTokenBalances(true);
      return true;
    },
    [],
  );

  const { isLoading: balanceLoading } = usePromiseResult(
    async () => {
      const requestKey = depositTokenRequestKey;
      const requestDefaultTokenIdentitiesKey = defaultTokenIdentitiesKey;
      if (
        !selectedAccount.accountId ||
        !selectedAccount.accountAddress ||
        !checkAccountSupport
      ) {
        depositTokenListOwnerKeyRef.current = undefined;
        setHasLoadedDepositTokenBalances(true);
        return [];
      }
      try {
        const {
          isStale,
          ownerKey,
          tokens: depositTokens,
        } = await backgroundApiProxy.serviceWebviewPerp.fetchPerpsDepositTokensFromWalletTokenList(
          {
            accountId: selectedAccount.accountId ?? '',
            indexedAccountId: selectedAccount.indexedAccountId ?? undefined,
          },
        );
        if (
          isStale ||
          depositTokenRequestKeyRef.current !== requestKey ||
          getPerpsDepositTokensIdentityKey(defaultTokensRef.current) !==
            requestDefaultTokenIdentitiesKey
        ) {
          return [];
        }
        depositTokenListOwnerKeyRef.current = ownerKey;
        const displayDepositTokens = getPerpsDepositTokensWithDefaultFallback({
          walletTokens: depositTokens,
          defaultTokens: defaultTokensRef.current,
        });
        const didSync = await syncDepositTokenBalances({
          depositTokens: displayDepositTokens,
          requestKey,
          preserveCurrentOrder: depositTokensWithPriceRef.current.length > 0,
        });
        if (!didSync) {
          return [];
        }
        return displayDepositTokens;
      } catch (error) {
        if (depositTokenRequestKeyRef.current !== requestKey) {
          return [];
        }
        console.error(
          '[DepositWithdrawModal] Failed to fetch tokens balance:',
          error,
        );
        setDepositTokensWithPrice([]);
        setHasLoadedDepositTokenBalances(true);
        setPerpsDepositTokensAtom((prev) => ({
          ...prev,
          currentPerpsDepositSelectedToken: undefined,
        }));
        return [];
      }
    },
    [
      selectedAccount.accountId,
      selectedAccount.accountAddress,
      selectedAccount.indexedAccountId,
      depositTokenRequestKey,
      checkAccountSupport,
      defaultTokenIdentitiesKey,
      setPerpsDepositTokensAtom,
      syncDepositTokenBalances,
    ],
    {
      watchLoading: true,
      checkIsMounted: true,
      revalidateOnFocus: true,
    },
  );

  const silentlyRefreshDepositTokenBalances = useCallback(async () => {
    const requestKey = depositTokenRequestKey;
    if (
      !selectedAccount.accountId ||
      !selectedAccount.accountAddress ||
      !checkAccountSupport
    ) {
      return;
    }

    try {
      const {
        isStale,
        ownerKey,
        tokens: depositTokens,
      } = await backgroundApiProxy.serviceWebviewPerp.fetchPerpsDepositTokensFromWalletTokenList(
        {
          accountId: selectedAccount.accountId,
          indexedAccountId: selectedAccount.indexedAccountId ?? undefined,
          forceRefresh: true,
        },
      );
      if (isStale || depositTokenRequestKeyRef.current !== requestKey) {
        return;
      }
      depositTokenListOwnerKeyRef.current = ownerKey;
      await syncDepositTokenBalances({
        depositTokens: getPerpsDepositTokensWithDefaultFallback({
          walletTokens: depositTokens,
          defaultTokens,
        }),
        requestKey,
        preserveCurrentOrder: true,
      });
    } catch (error) {
      if (depositTokenRequestKeyRef.current !== requestKey) {
        return;
      }
      console.error(
        '[DepositWithdrawModal] Failed to silently refresh tokens balance:',
        error,
      );
    }
  }, [
    selectedAccount.accountId,
    selectedAccount.accountAddress,
    selectedAccount.indexedAccountId,
    depositTokenRequestKey,
    checkAccountSupport,
    defaultTokens,
    syncDepositTokenBalances,
  ]);

  useEffect(() => {
    if (
      !checkAccountSupport ||
      !depositTokenListOwnerKey ||
      depositTokenListOwnerKey !== depositTokenListOwnerKeyRef.current ||
      depositTokenListRevision === undefined ||
      depositTokenListRevision === lastSyncedDepositTokenListRevisionRef.current
    ) {
      return;
    }

    lastSyncedDepositTokenListRevisionRef.current = depositTokenListRevision;
    void syncDepositTokenBalances({
      depositTokens: getPerpsDepositTokensWithDefaultFallback({
        walletTokens: cachedDepositTokens,
        defaultTokens,
      }),
      requestKey: depositTokenRequestKeyRef.current,
      preserveCurrentOrder: depositTokensWithPriceRef.current.length > 0,
    });
  }, [
    cachedDepositTokens,
    checkAccountSupport,
    defaultTokens,
    depositTokenListOwnerKey,
    depositTokenListRevision,
    syncDepositTokenBalances,
  ]);

  useEffect(() => {
    depositTokenListOwnerKeyRef.current = undefined;
    lastSyncedDepositTokenListRevisionRef.current = undefined;
    setDepositTokensWithPrice([]);
    setNativeTokenConfigs([]);
    setHasLoadedDepositTokenBalances(false);
  }, [
    selectedAccount.accountId,
    selectedAccount.accountAddress,
    selectedAccount.indexedAccountId,
    checkAccountSupport,
  ]);

  const { normalizeTxConfirm } = useSignatureConfirm({
    accountId: selectedAccount.accountId || '',
    networkId: currentPerpsDepositSelectedToken?.networkId || '',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedAction]);

  useEffect(() => {
    currentPerpsDepositSelectedTokenRef.current =
      currentPerpsDepositSelectedToken;
  }, [currentDepositTokenIdentity, currentPerpsDepositSelectedToken]);

  useEffect(() => {
    if (selectedAction !== 'deposit') {
      previousDepositTokenIdentityRef.current = undefined;
      return;
    }
    const previousTokenIdentity = previousDepositTokenIdentityRef.current;
    previousDepositTokenIdentityRef.current = currentDepositTokenIdentity;

    if (
      previousTokenIdentity &&
      currentDepositTokenIdentity &&
      previousTokenIdentity !== currentDepositTokenIdentity
    ) {
      setAmount('');
      setDepositInputUnit('usd');
      setShowMinAmountError(false);
    }
  }, [currentDepositTokenIdentity, selectedAction]);

  useEffect(() => {
    if (depositTokensWithPrice.length === 0) return;

    const previousToken = currentPerpsDepositSelectedTokenRef.current;
    const selectedToken = resolvePerpsDepositSelectedToken({
      tokens: depositTokensWithPrice,
      currentToken: previousToken,
      defaultTokens,
      preserveCurrentToken: shouldPreservePerpsDepositSelectedToken({
        depositTokenListSource,
        currentToken: previousToken,
        tokens: depositTokensWithPrice,
      }),
    });
    if (selectedToken) {
      setPerpsDepositTokensAtom((prev) => {
        const currentToken = prev.currentPerpsDepositSelectedToken;
        if (
          arePerpsDepositSelectedTokenRefreshFieldsEqual({
            currentToken,
            nextToken: selectedToken,
          })
        ) {
          return prev;
        }
        return equalTokenNoCaseSensitive({
          token1: currentToken,
          token2: selectedToken,
        })
          ? {
              ...prev,
              currentPerpsDepositSelectedToken: {
                ...currentToken,
                networkId: selectedToken.networkId,
                contractAddress: selectedToken.contractAddress,
                name: selectedToken.name,
                symbol: selectedToken.symbol,
                decimals: selectedToken.decimals,
                networkLogoURI: selectedToken.networkLogoURI,
                logoURI: selectedToken.logoURI,
                isNative: selectedToken.isNative,
                balanceParsed: selectedToken.balanceParsed,
                fiatValue: selectedToken.fiatValue,
                price: selectedToken.price,
              },
            }
          : {
              ...prev,
              currentPerpsDepositSelectedToken: selectedToken,
            };
      });
    }
  }, [
    defaultTokens,
    depositTokensWithPrice,
    depositTokenListSource,
    setPerpsDepositTokensAtom,
  ]);

  const availableBalance = useMemo(() => {
    const rawBalance =
      selectedAction === 'withdraw'
        ? withdrawable || '0'
        : (currentPerpsDepositSelectedToken?.balanceParsed ?? '0');
    const balanceFormatted = numberFormat(rawBalance, { formatter: 'balance' });
    const displayBalance =
      selectedAction === 'withdraw'
        ? `${balanceFormatted} ${USDC_TOKEN_INFO.symbol}`
        : `${balanceFormatted} ${
            currentPerpsDepositSelectedToken?.symbol ?? ''
          }`;
    return {
      balance: rawBalance,
      displayBalance,
    };
  }, [
    selectedAction,
    withdrawable,
    currentPerpsDepositSelectedToken?.balanceParsed,
    currentPerpsDepositSelectedToken?.symbol,
  ]);
  const hasCachedWithdrawableValue =
    computedValue?.withdrawable !== undefined &&
    computedValue?.withdrawable !== null &&
    computedValue?.withdrawable !== '';
  const shouldShowWithdrawableSkeleton =
    perpsAccountLoading?.selectAccountLoading && !hasCachedWithdrawableValue;

  const amountBN = useMemo(() => new BigNumber(amount || '0'), [amount]);

  const tokenPriceBN = useMemo(
    () => new BigNumber(currentPerpsDepositSelectedToken?.price || '0'),
    [currentPerpsDepositSelectedToken?.price],
  );

  const isUsdInput = selectedAction === 'deposit' && depositInputUnit === 'usd';
  const shouldUseNativeAmountKeypad = platformEnv.isNative;

  const tokenAmountBN = useMemo(() => {
    if (isUsdInput && tokenPriceBN.gt(0)) {
      return amountBN.dividedBy(tokenPriceBN);
    }
    return amountBN;
  }, [amountBN, isUsdInput, tokenPriceBN]);

  const tokenAmount = useMemo(
    () =>
      tokenAmountBN.isNaN() || tokenAmountBN.lte(0)
        ? ''
        : tokenAmountBN
            .decimalPlaces(
              currentPerpsDepositSelectedToken?.decimals ?? 6,
              BigNumber.ROUND_DOWN,
            )
            .toFixed(),
    [tokenAmountBN, currentPerpsDepositSelectedToken?.decimals],
  );

  const convertedDisplayValue = useMemo(() => {
    if (selectedAction !== 'deposit' || amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }
    if (isUsdInput && tokenPriceBN.gt(0)) {
      const displayDecimals = Math.min(
        currentPerpsDepositSelectedToken?.decimals ?? 6,
        8,
      );
      const tokenVal = amountBN
        .dividedBy(tokenPriceBN)
        .decimalPlaces(displayDecimals, BigNumber.ROUND_DOWN);
      return tokenVal.toFixed();
    }
    if (!isUsdInput && tokenPriceBN.gt(0)) {
      const usdVal = amountBN
        .multipliedBy(tokenPriceBN)
        .decimalPlaces(2, BigNumber.ROUND_DOWN);
      return usdVal.toFixed(2);
    }
    return '';
  }, [
    selectedAction,
    amountBN,
    isUsdInput,
    tokenPriceBN,
    currentPerpsDepositSelectedToken?.decimals,
  ]);

  const availableBalanceBN = useMemo(
    () => new BigNumber(availableBalance.balance || '0'),
    [availableBalance.balance],
  );

  const checkFromTokenFiatValue = useMemo(() => {
    return getPerpsDepositMinimumCheck({
      inputAmount: amount,
      isUsdInput,
      tokenPrice: currentPerpsDepositSelectedToken?.price,
      tokenDecimals: currentPerpsDepositSelectedToken?.decimals,
    });
  }, [
    amount,
    isUsdInput,
    currentPerpsDepositSelectedToken?.decimals,
    currentPerpsDepositSelectedToken?.price,
  ]);

  const isValidAmount = useMemo(() => {
    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    const hasActiveAmount = !!amount;
    const isBelowDepositMin =
      selectedAction === 'deposit' &&
      hasActiveAmount &&
      !checkFromTokenFiatValue.value;
    const isBelowWithdrawMin =
      selectedAction === 'withdraw' &&
      hasActiveAmount &&
      amountBN.lt(MIN_WITHDRAW_AMOUNT);

    if (selectedAction === 'deposit') {
      return tokenAmountBN.lte(availableBalanceBN) && !isBelowDepositMin;
    }

    if (selectedAction === 'withdraw') {
      return amountBN.lte(availableBalanceBN) && !isBelowWithdrawMin;
    }

    return true;
  }, [
    amount,
    amountBN,
    tokenAmountBN,
    availableBalanceBN,
    selectedAction,
    checkFromTokenFiatValue.value,
  ]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    if (amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinAmountError && !checkFromTokenFiatValue.value) {
        return intl.formatMessage(
          { id: ETranslations.perp_mini_deposit },
          {
            num: checkFromTokenFiatValue.minFromTokenAmount,
            token: currentPerpsDepositSelectedToken?.symbol ?? '-',
          },
        );
      }
    }

    if (selectedAction === 'withdraw') {
      if (showMinAmountError && amountBN.lt(MIN_WITHDRAW_AMOUNT)) {
        return intl.formatMessage(
          { id: ETranslations.perp_mini_withdraw },
          { num: MIN_WITHDRAW_AMOUNT, token: 'USDC' },
        );
      }
    }

    return '';
  }, [
    amount,
    amountBN,
    selectedAction,
    showMinAmountError,
    checkFromTokenFiatValue.value,
    checkFromTokenFiatValue.minFromTokenAmount,
    intl,
    currentPerpsDepositSelectedToken?.symbol,
  ]);

  const depositQuoteAmountDebounced = useDebounce(tokenAmount, 800);
  const shouldEnableDepositQuote =
    selectedAction === 'deposit' && checkAccountSupport;
  const selectedActionForDepositQuote: IPerpsDepositWithdrawActionType =
    shouldEnableDepositQuote ? selectedAction : 'withdraw';

  const {
    perpDepositQuote,
    perpDepositQuoteLoading,
    buildPerpDepositTx,
    multipleStepText,
    isArbitrumUsdcToken,
    shouldApprove,
    shouldResetApprove,
    checkRefreshQuote,
    perpDepositQuoteAction,
    handlePerpDepositTxSuccess,
  } = usePerpDeposit(
    shouldEnableDepositQuote ? depositQuoteAmountDebounced : amount,
    selectedActionForDepositQuote,
    selectedAccount.indexedAccountId ?? '',
    selectedAccount.accountId ?? '',
    shouldEnableDepositQuote ? currentPerpsDepositSelectedToken : undefined,
    shouldEnableDepositQuote && checkFromTokenFiatValue.value,
  );

  const isDepositQuotePendingDebounce = useMemo(
    () =>
      shouldWaitForPerpsDepositQuoteDebounce({
        selectedAction: selectedActionForDepositQuote,
        isArbitrumUsdcToken,
        canQuoteDepositAmount:
          shouldEnableDepositQuote && checkFromTokenFiatValue.value,
        tokenAmount,
        debouncedTokenAmount: depositQuoteAmountDebounced,
      }),
    [
      checkFromTokenFiatValue.value,
      depositQuoteAmountDebounced,
      isArbitrumUsdcToken,
      selectedActionForDepositQuote,
      shouldEnableDepositQuote,
      tokenAmount,
    ],
  );

  const isDepositQuoteLoading = useMemo(
    () => perpDepositQuoteLoading || isDepositQuotePendingDebounce,
    [isDepositQuotePendingDebounce, perpDepositQuoteLoading],
  );

  const shouldRefreshDepositQuote = useMemo(
    () =>
      shouldEnableDepositQuote &&
      (checkRefreshQuote || isDepositQuotePendingDebounce),
    [
      checkRefreshQuote,
      isDepositQuotePendingDebounce,
      shouldEnableDepositQuote,
    ],
  );
  const shouldShowDepositQuoteRefresh =
    shouldEnableDepositQuote && !isArbitrumUsdcToken;
  const canSwitchDepositInputUnit =
    shouldEnableDepositQuote && tokenPriceBN.gt(0);

  const handleAmountChange = useCallback(
    (value: string) => {
      const decimals =
        selectedAction === 'deposit' && depositInputUnit === 'usd'
          ? 2
          : currentPerpsDepositSelectedToken?.decimals;
      if (validateAmountInput(value, decimals)) {
        setAmount(value);
      }
    },
    [
      currentPerpsDepositSelectedToken?.decimals,
      selectedAction,
      depositInputUnit,
    ],
  );

  const handleNativeAmountKeyPress = useCallback(
    (key: string) => {
      if (
        !shouldUseNativeAmountKeypad ||
        isSubmitting ||
        !checkAccountSupport
      ) {
        return;
      }
      if (key === 'backspace') {
        setAmount((prev) => prev.slice(0, -1));
        return;
      }
      if (key === '.') {
        if (amount.includes('.')) {
          return;
        }
        handleAmountChange(amount ? `${amount}.` : '0.');
        return;
      }
      const nextValue = amount === '0' ? key : `${amount}${key}`;
      handleAmountChange(nextValue);
    },
    [
      amount,
      checkAccountSupport,
      handleAmountChange,
      isSubmitting,
      shouldUseNativeAmountKeypad,
    ],
  );

  const handleNativeAmountBackspaceLongPress = useCallback(() => {
    if (!shouldUseNativeAmountKeypad || isSubmitting || !checkAccountSupport) {
      return;
    }
    setAmount('');
  }, [checkAccountSupport, isSubmitting, shouldUseNativeAmountKeypad]);
  const handleAmountBlur = useCallback(() => {
    if (amount && !amountBN.isNaN() && amountBN.gt(0)) {
      if (selectedAction === 'deposit' && !checkFromTokenFiatValue.value) {
        setShowMinAmountError(true);
      } else if (
        selectedAction === 'withdraw' &&
        amountBN.lt(MIN_WITHDRAW_AMOUNT)
      ) {
        setShowMinAmountError(true);
      }
    }
  }, [amount, amountBN, selectedAction, checkFromTokenFiatValue.value]);

  const checkNativeTokenGasToast = useCallback(
    (
      isNative?: boolean,
      tokenNetworkId?: string,
      tokenBalance?: string,
      tokenSymbol?: string,
      tokenDecimals?: number,
    ) => {
      let maxAmount = new BigNumber(tokenBalance || 0);
      if (isNative) {
        const reserveGas = nativeTokenConfigs.find(
          (item) => item.networkId === tokenNetworkId,
        )?.reserveGas;
        if (reserveGas) {
          maxAmount = BigNumber.max(
            0,
            maxAmount.minus(new BigNumber(reserveGas)),
          ).decimalPlaces(tokenDecimals ?? 6, BigNumber.ROUND_DOWN);
        }
        let reserveGasFormatted: string | undefined | number = reserveGas;
        if (reserveGas) {
          reserveGasFormatted = numberFormat(reserveGas.toString(), {
            formatter: 'balance',
            formatterOptions: {
              tokenSymbol,
            },
          });
        }
        const message = intl.formatMessage(
          {
            id: reserveGasFormatted
              ? ETranslations.swap_native_token_max_tip_already
              : ETranslations.swap_native_token_max_tip,
          },
          {
            num_token: reserveGasFormatted,
          },
        );
        Toast.message({
          title: message,
        });
      }
      return maxAmount;
    },
    [nativeTokenConfigs, intl],
  );

  const handleToggleInputUnit = useCallback(() => {
    if (!canSwitchDepositInputUnit) return;
    const newUnit = depositInputUnit === 'token' ? 'usd' : 'token';
    if (amount && !amountBN.isNaN() && amountBN.gt(0) && tokenPriceBN.gt(0)) {
      if (newUnit === 'usd') {
        const usdVal = amountBN
          .multipliedBy(tokenPriceBN)
          .decimalPlaces(2, BigNumber.ROUND_DOWN);
        setAmount(usdVal.toFixed());
      } else {
        const tokenVal = amountBN
          .dividedBy(tokenPriceBN)
          .decimalPlaces(
            currentPerpsDepositSelectedToken?.decimals ?? 6,
            BigNumber.ROUND_DOWN,
          );
        setAmount(tokenVal.toFixed());
      }
    }
    setDepositInputUnit(newUnit);
  }, [
    canSwitchDepositInputUnit,
    depositInputUnit,
    amount,
    amountBN,
    tokenPriceBN,
    currentPerpsDepositSelectedToken?.decimals,
  ]);

  const handleMaxPress = useCallback(
    (tokenParams?: {
      networkId: string;
      isNative: boolean;
      amount: string;
      symbol: string;
      decimals: number;
      price?: string;
    }) => {
      if (tokenParams && selectedAction === 'deposit') {
        const maxAmount = checkNativeTokenGasToast(
          tokenParams.isNative,
          tokenParams.networkId,
          tokenParams.amount,
          tokenParams.symbol,
          tokenParams.decimals,
        );
        const priceBN = tokenParams.price
          ? new BigNumber(tokenParams.price)
          : tokenPriceBN;
        const maxTokenAmount = maxAmount.toFixed();
        let nextAmount = maxTokenAmount;
        if (depositInputUnit === 'usd' && priceBN.gt(0)) {
          const usdVal = maxAmount
            .multipliedBy(priceBN)
            .decimalPlaces(2, BigNumber.ROUND_DOWN);
          nextAmount = usdVal.toFixed();
        }
        setAmount(nextAmount);
        return;
      }
      if (availableBalance) {
        const nextAmount = availableBalance.balance || '0';
        setAmount(nextAmount);
      }
    },
    [
      availableBalance,
      checkNativeTokenGasToast,
      selectedAction,
      depositInputUnit,
      tokenPriceBN,
    ],
  );

  useEffect(() => {
    if (!amount || amountBN.isNaN() || amountBN.lte(0)) {
      setShowMinAmountError(false);
      return;
    }

    if (selectedAction === 'deposit') {
      setShowMinAmountError(!checkFromTokenFiatValue.value);
      return;
    }

    if (selectedAction === 'withdraw') {
      setShowMinAmountError(amountBN.lt(MIN_WITHDRAW_AMOUNT));
      return;
    }

    setShowMinAmountError(false);
  }, [amount, amountBN, checkFromTokenFiatValue.value, selectedAction]);

  const validateAmountBeforeSubmit = useCallback(() => {
    if (amountBN.isNaN() || amountBN.lte(0)) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.dexmarket_enter_amount }),
      });
      return false;
    }

    const balanceCheckBN =
      selectedAction === 'deposit' ? tokenAmountBN : amountBN;
    if (balanceCheckBN.gt(availableBalanceBN)) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.earn_insufficient_balance,
        }),
      });
      return false;
    }

    if (selectedAction === 'deposit' && !checkFromTokenFiatValue.value) {
      setShowMinAmountError(true);
      const message = intl.formatMessage(
        { id: ETranslations.perp_mini_deposit },
        {
          num: checkFromTokenFiatValue.minFromTokenAmount,
          token: currentPerpsDepositSelectedToken?.symbol ?? '-',
        },
      );
      Toast.error({ title: message });
      return false;
    }

    if (selectedAction === 'withdraw' && amountBN.lt(MIN_WITHDRAW_AMOUNT)) {
      setShowMinAmountError(true);
      const message = intl.formatMessage(
        { id: ETranslations.perp_mini_withdraw },
        { num: MIN_WITHDRAW_AMOUNT, token: 'USDC' },
      );
      Toast.error({ title: message });
      return false;
    }

    if (showMinAmountError) {
      setShowMinAmountError(false);
    }

    return true;
  }, [
    amountBN,
    tokenAmountBN,
    availableBalanceBN,
    checkFromTokenFiatValue.minFromTokenAmount,
    checkFromTokenFiatValue.value,
    currentPerpsDepositSelectedToken?.symbol,
    intl,
    selectedAction,
    showMinAmountError,
  ]);

  const leftContent = useMemo(() => {
    return selectedAction === 'deposit' ? (
      <SizableText
        size="$bodyLgMedium"
        color={getPerpsDepositMinAmountTextColor(selectedAction)}
      >
        {intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: `$${MIN_DEPOSIT_AMOUNT}` },
        )}
      </SizableText>
    ) : (
      <SizableText
        size="$bodyLgMedium"
        color={getPerpsDepositMinAmountTextColor(selectedAction)}
      >
        {intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: `${MIN_WITHDRAW_AMOUNT} USDC` },
        )}
      </SizableText>
    );
  }, [intl, selectedAction]);

  const handleConfirm = useCallback(async () => {
    if (
      !isValidAmount ||
      !selectedAccount.accountAddress ||
      !checkAccountSupport
    )
      return;

    const canSubmit = validateAmountBeforeSubmit();
    if (!canSubmit) return;

    // Bot Wallet deactivated warning
    if (selectedAccount.accountId) {
      const isDeactivatedBot = await isAccountIdDeactivatedBotWallet({
        accountId: selectedAccount.accountId,
      });
      if (isDeactivatedBot) {
        const confirmed = await showBotWalletDeactivatedWarningDialog();
        if (!confirmed) {
          return;
        }
      }
    }

    try {
      if (isDepositQuotePendingDebounce) {
        return;
      }
      if (shouldRefreshDepositQuote) {
        void perpDepositQuoteAction();
        return;
      }
      if (
        selectedAction === 'deposit' &&
        (await checkDepositWalletNotBackedUp())
      ) {
        return;
      }
      setIsSubmitting(true);
      if (selectedAction === 'deposit') {
        if (isArbitrumUsdcToken) {
          await normalizeTxConfirm({
            onSuccess: async (data: ISendTxOnSuccessData[]) => {
              await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
              if (data?.[0]) {
                const fromTxId = data[0].signedTx.txid;
                const usdcToken = {
                  networkId: PERPS_NETWORK_ID,
                  contractAddress: USDC_TOKEN_INFO.address,
                  name: USDC_TOKEN_INFO.name,
                  symbol: USDC_TOKEN_INFO.symbol,
                  decimals: USDC_TOKEN_INFO.decimals,
                  networkLogoURI:
                    swapDefaultSetTokens[PERPS_NETWORK_ID].toToken
                      ?.networkLogoURI ?? '',
                };
                const depositAmount = tokenAmount || amount;
                void handlePerpDepositTxSuccess({
                  fromToken:
                    currentPerpsDepositSelectedTokenRef.current ?? usdcToken,
                  fromTxId,
                  toAmount: depositAmount,
                  fromAmount: depositAmount,
                  isArbUSDCOrder: true,
                  skipToast: true,
                });
              }
              void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
              onClose?.();
            },
            transfersInfo: [
              {
                from: selectedAccount.accountAddress,
                to: HYPERLIQUID_DEPOSIT_ADDRESS,
                amount: tokenAmount || amount,
                tokenInfo: USDC_TOKEN_INFO,
              },
            ],
            gasAccountScenario: 'perps',
          });
        } else {
          await buildPerpDepositTx();
          void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
          onClose?.();
        }
      } else {
        await withdraw({
          userAccountId: selectedAccount.accountId || '',
          amount,
          destination: selectedAccount.accountAddress,
        });
        void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
        onClose?.();
      }
    } catch (error) {
      console.error(`[DepositWithdrawModal.${selectedAction}] Failed:`, error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidAmount,
    checkAccountSupport,
    selectedAccount.accountAddress,
    selectedAccount.accountId,
    validateAmountBeforeSubmit,
    selectedAction,
    checkDepositWalletNotBackedUp,
    perpDepositQuoteAction,
    isArbitrumUsdcToken,
    normalizeTxConfirm,
    amount,
    tokenAmount,
    handlePerpDepositTxSuccess,
    onClose,
    buildPerpDepositTx,
    withdraw,
    isDepositQuotePendingDebounce,
    shouldRefreshDepositQuote,
  ]);

  const nativeInputProps = platformEnv.isNativeIOS
    ? { inputAccessoryViewID: DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID }
    : {};

  const isInsufficientBalance = useMemo(() => {
    const checkBN = selectedAction === 'deposit' ? tokenAmountBN : amountBN;
    return checkBN.gt(availableBalanceBN) && checkBN.gt(0);
  }, [amountBN, tokenAmountBN, availableBalanceBN, selectedAction]);

  const amountInputErrorMessage = useMemo(() => {
    if (isInsufficientBalance) {
      return intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    }

    return errorMessage;
  }, [errorMessage, intl, isInsufficientBalance]);

  const accountTypeInfo = useMemo(() => {
    const isHwWallet = accountUtils.isHwAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    const isExternalAccount = accountUtils.isExternalAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    return {
      isHwWallet,
      isExternalAccount,
    };
  }, [selectedAccount.accountId]);

  const buttonText = useMemo(() => {
    if (isInsufficientBalance)
      return intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    let depositActionText = intl.formatMessage({
      id: ETranslations.perp_trade_deposit,
    });
    if (multipleStepText) {
      depositActionText = multipleStepText;
    }
    if (shouldApprove) {
      depositActionText = intl.formatMessage({
        id: ETranslations.perp_lifi_deposit_approve,
      });
      if (accountTypeInfo.isHwWallet) {
        depositActionText = intl.formatMessage({
          id: shouldResetApprove
            ? ETranslations.swap_review_confirm_3_on_device
            : ETranslations.swap_review_confirm_2_on_device,
        });
      }
      if (accountTypeInfo.isExternalAccount) {
        depositActionText = intl.formatMessage({
          id: shouldResetApprove
            ? ETranslations.swap_review_confirm_3_on_wallet
            : ETranslations.swap_review_confirm_2_on_wallet,
        });
      }
    }
    if (shouldRefreshDepositQuote) {
      depositActionText = intl.formatMessage({
        id: ETranslations.swap_page_button_refresh_quotes,
      });
    }
    if (isDepositQuoteLoading) {
      depositActionText = intl.formatMessage({
        id: ETranslations.swap_page_button_fetching_quotes,
      });
    }
    return selectedAction === 'deposit'
      ? depositActionText
      : intl.formatMessage({ id: ETranslations.perp_trade_withdraw });
  }, [
    isInsufficientBalance,
    intl,
    multipleStepText,
    shouldApprove,
    selectedAction,
    accountTypeInfo.isHwWallet,
    accountTypeInfo.isExternalAccount,
    shouldResetApprove,
    isDepositQuoteLoading,
    shouldRefreshDepositQuote,
  ]);

  const shouldShowBuyButton = useMemo(
    () =>
      isInsufficientBalance &&
      selectedAction === 'deposit' &&
      checkAccountSupport &&
      !balanceLoading,
    [
      isInsufficientBalance,
      selectedAction,
      checkAccountSupport,
      balanceLoading,
    ],
  );

  const fallbackSelectedDepositToken = useMemo(() => {
    return resolvePerpsDepositSelectedToken({
      tokens: cachedDepositTokens,
      defaultTokens,
    });
  }, [cachedDepositTokens, defaultTokens]);

  const resolvedCurrentPerpsDepositSelectedToken =
    currentPerpsDepositSelectedToken ?? fallbackSelectedDepositToken;

  useEffect(() => {
    if (!checkAccountSupport) {
      if (currentPerpsDepositSelectedToken) {
        setPerpsDepositTokensAtom((prev) => {
          if (!prev.currentPerpsDepositSelectedToken) {
            return prev;
          }
          return {
            ...prev,
            currentPerpsDepositSelectedToken: undefined,
          };
        });
      }
      return;
    }

    if (!currentPerpsDepositSelectedToken && fallbackSelectedDepositToken) {
      const selectedToken =
        resolvePerpsDepositSelectedToken({
          tokens: depositTokensWithPrice,
          defaultTokens,
        }) ?? fallbackSelectedDepositToken;
      setPerpsDepositTokensAtom((prev) => {
        if (prev.currentPerpsDepositSelectedToken) {
          return prev;
        }
        return {
          ...prev,
          currentPerpsDepositSelectedToken: selectedToken,
        };
      });
    }
  }, [
    fallbackSelectedDepositToken,
    depositTokensWithPrice,
    defaultTokens,
    currentPerpsDepositSelectedToken,
    setPerpsDepositTokensAtom,
    checkAccountSupport,
  ]);

  const currentNetworkInfo = useMemo(() => {
    if (!resolvedCurrentPerpsDepositSelectedToken?.networkId) return null;
    return networkUtils.getLocalNetworkInfo(
      resolvedCurrentPerpsDepositSelectedToken.networkId,
    );
  }, [resolvedCurrentPerpsDepositSelectedToken?.networkId]);

  const perpsNetworkInfo = useMemo(
    () => networkUtils.getLocalNetworkInfo(PERPS_NETWORK_ID),
    [],
  );

  const openTokenSelectorPage = useCallback(() => {
    if (!checkAccountSupport || balanceLoading) return;
    void preloadPerpsDepositSelectTokenModal();
    void dismissKeyboardWithDelay();
    void silentlyRefreshDepositTokenBalances();
    if (isMobile) {
      perpModalNavigation.push(EModalPerpRoutes.MobileDepositSelectToken, {
        depositTokensWithPrice,
        depositTokenListOwnerKey: depositTokenListOwnerKeyRef.current,
        hasLoadedDepositTokenBalances,
        symbol: PERPS_CURRENCY_SYMBOL,
      });
      return;
    }
    setDesktopDepositPage('selectToken');
  }, [
    balanceLoading,
    checkAccountSupport,
    depositTokensWithPrice,
    hasLoadedDepositTokenBalances,
    isMobile,
    perpModalNavigation,
    silentlyRefreshDepositTokenBalances,
  ]);

  useEffect(() => {
    if (!isMobile || selectedAction !== 'deposit') {
      return;
    }
    void preloadPerpsDepositSelectTokenModal();
  }, [isMobile, selectedAction]);

  const closeDesktopTokenSelectorPage = useCallback(() => {
    setDesktopDepositPage('form');
  }, []);

  const depositTokenSelectComponent = useMemo(() => {
    const shouldShowTokenSkeleton = shouldShowPerpsDepositTokenSkeleton({
      selectedAction,
      checkAccountSupport,
      hasLoadedDepositTokenBalances,
      depositTokensWithPriceLength: depositTokensWithPrice.length,
      hasDisplayDepositToken: Boolean(resolvedCurrentPerpsDepositSelectedToken),
    });
    if (shouldShowTokenSkeleton) {
      return (
        <XStack
          width="100%"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          minHeight={50}
        >
          <XStack alignItems="center" gap="$2.5" flex={1} minWidth={0}>
            <Skeleton w="$10" h="$10" radius="round" />
            <YStack flex={1} minWidth={0} justifyContent="center" gap="$2">
              <Skeleton h="$4" w="$24" borderRadius="$1" />
              <Skeleton h="$3" w="$18" borderRadius="$1" />
            </YStack>
          </XStack>
          <Skeleton h="$8" w={56} borderRadius="$full" />
        </XStack>
      );
    }

    const displayDepositToken = resolvedCurrentPerpsDepositSelectedToken;
    const hasSourceBalance = displayDepositToken?.balanceParsed !== undefined;
    const sourceBalanceFormatted = hasSourceBalance
      ? numberFormat(displayDepositToken?.balanceParsed ?? '0', {
          formatter: 'balance',
        })
      : '';
    const sourceBalanceText = `${sourceBalanceFormatted} ${
      displayDepositToken?.symbol ?? ''
    }`;

    return (
      <XStack
        width="100%"
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
        minHeight={50}
      >
        <YStack flex={1} minWidth={0}>
          <XStack
            testID="perp-deposit-token-selector"
            alignItems="center"
            gap="$2.5"
            flexShrink={1}
            minWidth={0}
            alignSelf="flex-start"
            cursor={checkAccountSupport ? 'pointer' : 'default'}
            onPress={openTokenSelectorPage}
          >
            <Token
              size="md"
              tokenImageUri={displayDepositToken?.logoURI}
              networkImageUri={displayDepositToken?.networkLogoURI}
              showNetworkIcon
            />
            <YStack flex={1} minWidth={0}>
              <YStack gap="$0.5">
                <XStack alignItems="center" gap="$1" flexWrap="wrap">
                  <SizableText size="$bodyMdMedium" color="$text">
                    {displayDepositToken?.symbol ?? '-'}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {currentNetworkInfo?.name ?? ''}
                  </SizableText>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$3.5"
                  />
                </XStack>
                <SizableText size="$bodySm" color="$textSubdued">
                  {hasSourceBalance ? sourceBalanceText : ' '}
                </SizableText>
              </YStack>
            </YStack>
          </XStack>
        </YStack>
        {checkAccountSupport ? (
          <Button
            testID="perp-deposit-token-max"
            variant="secondary"
            size="small"
            px="$2.5"
            h="$8"
            minWidth={56}
            ml="$1"
            disabled={!hasSourceBalance}
            onPress={() => {
              handleMaxPress({
                networkId: displayDepositToken?.networkId ?? '',
                isNative: !!displayDepositToken?.isNative,
                amount: displayDepositToken?.balanceParsed || '0',
                symbol: displayDepositToken?.symbol ?? '',
                decimals: displayDepositToken?.decimals ?? 6,
                price: displayDepositToken?.price,
              });
            }}
          >
            {intl.formatMessage({ id: ETranslations.send_max })}
          </Button>
        ) : null}
      </XStack>
    );
  }, [
    checkAccountSupport,
    currentNetworkInfo?.name,
    depositTokensWithPrice.length,
    handleMaxPress,
    hasLoadedDepositTokenBalances,
    intl,
    openTokenSelectorPage,
    resolvedCurrentPerpsDepositSelectedToken,
    selectedAction,
  ]);

  const depositToAmount = useMemo(() => {
    let depositToAmountRes = '0';
    if (isArbitrumUsdcToken) {
      depositToAmountRes = amountBN.toFixed();
    } else {
      depositToAmountRes = perpDepositQuote?.result?.toAmount ?? '0';
    }
    const depositToAmountBN = new BigNumber(depositToAmountRes);
    return {
      value: depositToAmountRes,
      canDeposit: depositToAmountBN.gt(0) && !depositToAmountBN.isNaN(),
    };
  }, [isArbitrumUsdcToken, amountBN, perpDepositQuote?.result?.toAmount]);

  const depositEstimateDescription = useMemo(() => {
    if (selectedAction !== 'deposit') {
      return '';
    }

    if (isArbitrumUsdcToken) {
      return `${intl.formatMessage({
        id: ETranslations.perp_deposit_eta_one_minute__desc,
      })} ${intl.formatMessage({
        id: ETranslations.perp_deposit_estimate_direct_arbitrum__desc,
      })}`;
    }

    return `${intl.formatMessage({
      id: ETranslations.perp_deposit_eta_one_minute__desc,
    })} ${intl.formatMessage({
      id: ETranslations.perp_deposit_estimate_defi__desc,
    })} ${intl.formatMessage({
      id: ETranslations.perp_deposit_estimate_route_refresh__desc,
    })}`;
  }, [isArbitrumUsdcToken, intl, selectedAction]);

  const shouldShowDepositEta = useMemo(
    () =>
      selectedAction === 'deposit' &&
      !isDepositQuoteLoading &&
      !!amount &&
      amountBN.gt(0) &&
      depositToAmount.canDeposit,
    [
      amount,
      amountBN,
      depositToAmount.canDeposit,
      isDepositQuoteLoading,
      selectedAction,
    ],
  );

  const depositEstimateHintTrigger = useMemo(
    () => (
      <DashText
        size="$bodySm"
        color="$textSubdued"
        dashColor="$textSubdued"
        dashThickness={0.5}
        cursor={gtMd ? 'help' : undefined}
      >
        {intl.formatMessage({
          id: ETranslations.private_send_estimated_received,
        })}
      </DashText>
    ),
    [gtMd, intl],
  );

  const depositEstimateHint = useMemo(() => {
    const shouldShowRouteLine =
      selectedAction === 'deposit' &&
      (isArbitrumUsdcToken || !!currentPerpsDepositSelectedToken?.symbol);
    const routeFromSymbol =
      perpDepositQuote?.result?.fromTokenInfo?.symbol ??
      currentPerpsDepositSelectedToken?.symbol ??
      '';
    const routeToSymbol =
      perpDepositQuote?.result?.toTokenInfo?.symbol ?? 'USDC';
    const routeProviderName =
      perpDepositQuote?.result?.info?.providerName?.trim() || 'Li.fi';
    const routeProviderLogo = perpDepositQuote?.result?.info?.providerLogo;
    const routeProviderLogoSrc =
      routeProviderLogo ||
      (routeProviderName === 'Li.fi' ? LIFI_FALLBACK_LOGO : undefined);
    const shouldShowToToken = routeFromSymbol !== routeToSymbol;
    const routeLine = shouldShowRouteLine ? (
      <XStack alignItems="center" gap="$1">
        {isArbitrumUsdcToken ? (
          <>
            <SizableText size="$bodyMd" color="$text">
              Arbitrum USDC
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              →
            </SizableText>
            <SizableText size="$bodyMd" color="$text">
              Hyperliquid
            </SizableText>
          </>
        ) : (
          <>
            {shouldShowToToken ? (
              <>
                <SizableText size="$bodyMd" color="$text">
                  {routeFromSymbol}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  →
                </SizableText>
              </>
            ) : null}
            {routeProviderLogoSrc ? (
              <Image
                src={
                  typeof routeProviderLogoSrc === 'string'
                    ? routeProviderLogoSrc
                    : undefined
                }
                source={
                  typeof routeProviderLogoSrc === 'string'
                    ? undefined
                    : routeProviderLogoSrc
                }
                size="$4"
                borderRadius="$1"
              />
            ) : null}
            <SizableText size="$bodyMd" color="$text">
              {routeProviderName}
            </SizableText>
            {shouldShowToToken ? (
              <>
                <SizableText size="$bodyMd" color="$textSubdued">
                  →
                </SizableText>
                <SizableText size="$bodyMd" color="$text">
                  {routeToSymbol}
                </SizableText>
              </>
            ) : null}
          </>
        )}
      </XStack>
    ) : null;

    const desktopContent = (
      <YStack px="$2" pt="$1.5" pb="$2.5" gap="$2">
        {routeLine}
        <SizableText size="$bodySm" color="$textSubdued">
          {depositEstimateDescription}
        </SizableText>
      </YStack>
    );

    const mobileContent = (
      <YStack px="$5" pt="$1.5" pb="$4" gap="$2">
        {routeLine}
        <SizableText size="$bodySm" color="$textSubdued">
          {depositEstimateDescription}
        </SizableText>
      </YStack>
    );

    if (gtMd) {
      return (
        <Tooltip
          renderTrigger={depositEstimateHintTrigger}
          renderContent={desktopContent}
        />
      );
    }

    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.private_send_estimated_received,
        })}
        renderTrigger={depositEstimateHintTrigger}
        renderContent={mobileContent}
      />
    );
  }, [
    currentPerpsDepositSelectedToken?.symbol,
    depositEstimateDescription,
    depositEstimateHintTrigger,
    gtMd,
    intl,
    isArbitrumUsdcToken,
    selectedAction,
    perpDepositQuote?.result,
  ]);

  const nativeAmountCtaLabel = useMemo(() => {
    if (shouldShowBuyButton) {
      return intl.formatMessage({ id: ETranslations.global_add_money });
    }
    return buttonText;
  }, [buttonText, intl, shouldShowBuyButton]);

  const withdrawFeeHintTrigger = useMemo(
    () => (
      <DashText
        size="$bodySm"
        color="$textSubdued"
        dashColor="$textSubdued"
        dashThickness={0.5}
        cursor={gtMd ? 'help' : undefined}
      >
        {intl.formatMessage({
          id: ETranslations.perp_withdraw_fee,
        })}
      </DashText>
    ),
    [gtMd, intl],
  );

  const withdrawFeeHint = useMemo(() => {
    if (gtMd) {
      return (
        <Tooltip
          renderTrigger={withdrawFeeHintTrigger}
          renderContent={
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_withdraw_fee_mgs,
              })}
            </SizableText>
          }
        />
      );
    }

    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.perp_withdraw_fee,
        })}
        renderTrigger={withdrawFeeHintTrigger}
        renderContent={
          <YStack px="$5" pb="$4">
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_withdraw_fee_mgs,
              })}
            </SizableText>
          </YStack>
        }
      />
    );
  }, [gtMd, intl, withdrawFeeHintTrigger]);

  const depositFooterContent =
    selectedAction === 'deposit' ? (
      <YStack gap="$3" flexShrink={0}>
        <YStack
          bg="$bgSubdued"
          borderRadius="$3"
          px="$3.5"
          py="$2"
          width="100%"
        >
          <XStack
            minHeight={44}
            alignItems="center"
            justifyContent="space-between"
            gap="$2.5"
          >
            <XStack alignItems="center" gap="$1.5">
              {depositEstimateHint}
              {shouldShowDepositQuoteRefresh ? (
                <Stack
                  w="$8"
                  h="$8"
                  ml="$-1"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$full"
                  cursor="pointer"
                  onPress={() => {
                    if (shouldEnableDepositQuote) {
                      void perpDepositQuoteAction();
                    }
                  }}
                  hoverStyle={{ opacity: 0.7 }}
                  pressStyle={{ opacity: 0.6 }}
                >
                  <Icon
                    name="RefreshCwOutline"
                    size="$3.5"
                    color="$iconSubdued"
                  />
                </Stack>
              ) : null}
            </XStack>
            {isDepositQuoteLoading ? (
              <Skeleton h="$4" w="$20" borderRadius="$1" />
            ) : (
              <YStack alignItems="flex-end" flexShrink={1}>
                <SizableText
                  size="$bodyLgMedium"
                  color="$text"
                  textAlign="right"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {numberFormat(depositToAmount.value, {
                    formatter: 'value',
                    formatterOptions: {
                      currency: PERPS_CURRENCY_SYMBOL,
                    },
                  })}
                </SizableText>
                {shouldShowDepositEta ? (
                  <SizableText
                    size="$bodyXs"
                    color="$textSubdued"
                    textAlign="right"
                    numberOfLines={2}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_deposit_eta_one_minute__desc,
                    })}
                  </SizableText>
                ) : null}
              </YStack>
            )}
          </XStack>
          <Stack h="$px" bg="$borderSubdued" my="$1.5" />
          {depositTokenSelectComponent}
        </YStack>

        {!shouldUseNativeAmountKeypad ? (
          <YStack pt="$1">
            {shouldShowBuyButton ? (
              <Button
                testID="perp-btn-buy"
                variant="primary"
                size={PERP_DIALOG_BUTTON_SIZE}
                icon="PlusLargeOutline"
                onPress={handleBuyPress}
              >
                {intl.formatMessage({ id: ETranslations.global_add_money })}
              </Button>
            ) : (
              <Button
                testID="perp-btn"
                variant="primary"
                size={PERP_DIALOG_BUTTON_SIZE}
                disabled={
                  !isValidAmount ||
                  isSubmitting ||
                  balanceLoading ||
                  !checkAccountSupport ||
                  isDepositQuoteLoading ||
                  (!depositToAmount.canDeposit && !shouldRefreshDepositQuote)
                }
                loading={isSubmitting}
                onPress={handleConfirm}
              >
                {buttonText}
              </Button>
            )}
          </YStack>
        ) : null}

        {shouldUseNativeAmountKeypad ? (
          <PerpsNativeAmountKeypad
            onKeyPress={handleNativeAmountKeyPress}
            onBackspaceLongPress={handleNativeAmountBackspaceLongPress}
            ctaLabel={nativeAmountCtaLabel}
            ctaDisabled={
              shouldShowBuyButton
                ? isSubmitting || balanceLoading || !checkAccountSupport
                : !isValidAmount ||
                  isSubmitting ||
                  balanceLoading ||
                  !checkAccountSupport ||
                  isDepositQuoteLoading ||
                  (!depositToAmount.canDeposit && !shouldRefreshDepositQuote)
            }
            ctaLoading={isSubmitting}
            onCtaPress={shouldShowBuyButton ? handleBuyPress : handleConfirm}
          />
        ) : null}
      </YStack>
    ) : null;

  const withdrawFooterContent =
    selectedAction === 'withdraw' ? (
      <YStack gap="$3" flexShrink={0}>
        <YStack
          bg="$bgSubdued"
          borderRadius="$3"
          px="$3.5"
          py="$2"
          width="100%"
          gap="$0.5"
        >
          <XStack
            minHeight={44}
            alignItems="center"
            justifyContent="space-between"
            gap="$2.5"
          >
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_account_panel_withrawable_value,
              })}
            </SizableText>
            {shouldShowWithdrawableSkeleton && checkAccountSupport ? (
              <Skeleton h="$4" w="$20" borderRadius="$1" />
            ) : (
              <XStack alignItems="center" gap="$2">
                <SizableText size="$bodyLgMedium" color="$text">
                  {availableBalance.displayBalance || '0.00'}
                </SizableText>
                <Button
                  testID="perp-withdraw-max"
                  variant="secondary"
                  size="small"
                  px="$2.5"
                  h="$8"
                  minWidth={56}
                  onPress={() => {
                    handleMaxPress();
                  }}
                >
                  {intl.formatMessage({ id: ETranslations.send_max })}
                </Button>
              </XStack>
            )}
          </XStack>
          <Stack h="$px" bg="$borderSubdued" my="$1.5" />
          <XStack
            minHeight={44}
            alignItems="center"
            justifyContent="space-between"
            gap="$2.5"
          >
            {withdrawFeeHint}
            <SizableText
              size="$bodyLgMedium"
              color="$text"
              textAlign="right"
              numberOfLines={1}
              flexShrink={1}
            >
              ${WITHDRAW_FEE}
            </SizableText>
          </XStack>
        </YStack>

        {!shouldUseNativeAmountKeypad ? (
          <YStack pt="$1">
            <Button
              testID="perp-btn"
              variant="primary"
              size={PERP_DIALOG_BUTTON_SIZE}
              disabled={
                !isValidAmount || isSubmitting || shouldShowWithdrawableSkeleton
              }
              loading={isSubmitting}
              onPress={handleConfirm}
            >
              {buttonText}
            </Button>
          </YStack>
        ) : null}

        {shouldUseNativeAmountKeypad ? (
          <PerpsNativeAmountKeypad
            onKeyPress={handleNativeAmountKeyPress}
            onBackspaceLongPress={handleNativeAmountBackspaceLongPress}
            ctaLabel={nativeAmountCtaLabel}
            ctaDisabled={
              !isValidAmount || isSubmitting || shouldShowWithdrawableSkeleton
            }
            ctaLoading={isSubmitting}
            onCtaPress={handleConfirm}
          />
        ) : null}
      </YStack>
    ) : null;

  const isDesktopDepositSelectTokenPage =
    selectedAction === 'deposit' &&
    !isMobile &&
    desktopDepositPage === 'selectToken';
  const amountInputMinHeight = getDepositWithdrawAmountInputMinHeight(isMobile);
  const depositAmountInputKey = platformEnv.isNativeAndroid
    ? `deposit-${currentDepositTokenIdentity ?? 'default'}`
    : `deposit-${currentDepositTokenIdentity ?? 'default'}-${depositInputUnit}`;

  let desktopDialogHeader: ReactNode = null;
  if (!isMobile && hideDesktopTitle) {
    desktopDialogHeader = isDesktopDepositSelectTokenPage ? (
      <Dialog.Header showExitButton>
        <XStack alignItems="center" gap="$3">
          <NavBackButton onPress={closeDesktopTokenSelectorPage} />
          <SizableText size="$heading2xl" color="$text">
            {intl.formatMessage({ id: ETranslations.global_select_crypto })}
          </SizableText>
        </XStack>
      </Dialog.Header>
    ) : (
      <Dialog.Header
        title={getDepositWithdrawTitle(selectedAction, intl)}
        showExitButton
      />
    );
  }

  const selectTokenContent = (
    <YStack flex={1} minHeight={0} height="100%" pt="$1">
      <DepositTokenSelectionContent
        symbol={PERPS_CURRENCY_SYMBOL}
        depositTokensWithPrice={depositTokensWithPrice}
        onClose={closeDesktopTokenSelectorPage}
        listHeight={PERP_DESKTOP_DEPOSIT_SELECT_TOKEN_LIST_HEIGHT}
        isLoading={balanceLoading}
        hasLoaded={hasLoadedDepositTokenBalances}
      />
    </YStack>
  );

  const formContent = (
    <YStack
      flex={1}
      height="100%"
      minHeight={0}
      gap="$4"
      px="$1"
      pt="$1"
      style={{ marginTop: isMobile || hideDesktopTitle ? 0 : -22 }}
    >
      {!isMobile && !hideDesktopTitle ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <SizableText size="$heading2xl" color="$text">
            {intl.formatMessage({
              id:
                selectedAction === 'deposit'
                  ? ETranslations.perp_trade_deposit
                  : ETranslations.perp_trade_withdraw,
            })}
          </SizableText>
        </XStack>
      ) : null}

      {selectedAction === 'deposit' ? (
        <YStack
          flex={1}
          height="100%"
          minHeight={0}
          gap={isMobile ? '$4' : '$0'}
          pt={isMobile ? '$8' : '$6'}
        >
          <Stack flex={1} minHeight={0} width="100%" justifyContent="center">
            <YStack
              width="100%"
              alignItems="center"
              justifyContent="center"
              gap="$2"
              py="$2"
              pb={isMobile ? '$2' : '$6'}
            >
              <SendAutoSizeAmountInput
                key={depositAmountInputKey}
                ref={amountInputRef}
                value={amount}
                onChange={handleAmountChange}
                minHeight={amountInputMinHeight}
                justifyContent="center"
                inlineTextAlignMode={!isMobile ? 'center' : 'auto'}
                tokenSymbol={
                  isUsdInput
                    ? undefined
                    : (currentPerpsDepositSelectedToken?.symbol ?? 'USDC')
                }
                reversible={canSwitchDepositInputUnit}
                valueProps={{
                  value:
                    amount && convertedDisplayValue
                      ? convertedDisplayValue
                      : '0.00',
                  currency:
                    !isUsdInput && canSwitchDepositInputUnit
                      ? PERPS_CURRENCY_SYMBOL
                      : undefined,
                  tokenSymbol: isUsdInput
                    ? (currentPerpsDepositSelectedToken?.symbol ?? 'USDC')
                    : undefined,
                  onPress: canSwitchDepositInputUnit
                    ? handleToggleInputUnit
                    : undefined,
                }}
                inputProps={{
                  ...nativeInputProps,
                  placeholder: '0',
                  editable: shouldUseNativeAmountKeypad
                    ? false
                    : !isSubmitting && checkAccountSupport,
                  onBlur: handleAmountBlur,
                  keyboardType: 'decimal-pad',
                  ...(isUsdInput && {
                    leftAddOnProps: {
                      label: PERPS_CURRENCY_SYMBOL,
                      pr: '$0',
                      pl: '$0',
                      mr: '$-2',
                    },
                  }),
                }}
                extraContent={
                  <Stack h="$6" justifyContent="center" alignItems="center">
                    {amountInputErrorMessage ? (
                      <SizableText size="$bodySm" color="$textCritical">
                        {amountInputErrorMessage}
                      </SizableText>
                    ) : null}
                  </Stack>
                }
                width="100%"
              />
            </YStack>
          </Stack>

          {isMobile ? depositFooterContent : null}
        </YStack>
      ) : null}
      {selectedAction !== 'deposit' ? (
        <YStack
          flex={1}
          height="100%"
          minHeight={0}
          gap={isMobile ? '$4' : '$0'}
          pt={isMobile ? '$8' : '$6'}
        >
          <Stack flex={1} minHeight={0} width="100%" justifyContent="center">
            <YStack
              width="100%"
              alignItems="center"
              justifyContent="center"
              gap="$2"
              py="$2"
              pb={isMobile ? '$2' : '$6'}
            >
              <SendAutoSizeAmountInput
                key="withdraw-usdc"
                ref={amountInputRef}
                value={amount}
                onChange={handleAmountChange}
                minHeight={amountInputMinHeight}
                justifyContent="center"
                inlineTextAlignMode={!isMobile ? 'center' : 'auto'}
                tokenSymbol={USDC_TOKEN_INFO.symbol}
                reversible={false}
                inputProps={{
                  ...nativeInputProps,
                  placeholder: '0',
                  editable: shouldUseNativeAmountKeypad
                    ? false
                    : !isSubmitting && checkAccountSupport,
                  onBlur: handleAmountBlur,
                  keyboardType: 'decimal-pad',
                }}
                extraContent={
                  <YStack
                    minHeight="$10"
                    justifyContent="center"
                    alignItems="center"
                    gap="$1"
                  >
                    <SizableText size="$bodySm" color="$textSubdued">
                      {intl.formatMessage({ id: ETranslations.global_to })}{' '}
                      {perpsNetworkInfo?.name ?? 'Arbitrum'}
                    </SizableText>
                    {errorMessage ? (
                      <SizableText size="$bodySm" color="$textCritical">
                        {errorMessage}
                      </SizableText>
                    ) : null}
                  </YStack>
                }
                width="100%"
              />
            </YStack>
          </Stack>

          {isMobile ? withdrawFooterContent : null}
        </YStack>
      ) : null}
    </YStack>
  );

  const content = isDesktopDepositSelectTokenPage ? (
    <YStack flex={1} minHeight={0} height="100%" position="relative">
      <YStack
        flex={1}
        minHeight={0}
        height="100%"
        opacity={0}
        pointerEvents="none"
      >
        {formContent}
      </YStack>
      <YStack position="absolute" top={0} right={0} bottom={0} left={0}>
        {selectTokenContent}
      </YStack>
    </YStack>
  ) : (
    formContent
  );

  return (
    <>
      {desktopDialogHeader}
      {content}
      {(selectedAction === 'deposit' || selectedAction === 'withdraw') &&
      !isMobile ? (
        <Dialog.Footer
          showFooter={false}
          extraContent={
            isDesktopDepositSelectTokenPage ? null : (
              <YStack px="$5" pb="$5">
                {selectedAction === 'deposit'
                  ? depositFooterContent
                  : withdrawFooterContent}
              </YStack>
            )
          }
        />
      ) : null}
      {platformEnv.isNativeIOS && !shouldUseNativeAmountKeypad ? (
        <InputAccessoryView nativeID={DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID}>
          <InputAccessoryDoneButton leftContent={leftContent} />
        </InputAccessoryView>
      ) : null}
    </>
  );
}

function MobileDepositWithdrawModal() {
  const intl = useIntl();
  const navigation = useNavigation();
  const appNavigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileDepositWithdrawModal
      >
    >();
  const actionType = route.params?.actionType ?? 'deposit';
  const [selectedAccount] = usePerpsActiveAccountAtom();

  const handleClose = useCallback(() => {
    setTimeout(
      () => {
        navigation.goBack();
      },
      platformEnv.isNative ? 350 : 0,
    );
  }, [navigation]);

  const handleViewHistory = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.PerpTradersHistoryList,
      params: { initialTab: 'Account' },
    });
  }, [appNavigation]);

  const renderHeaderRight = useCallback(
    () => (
      <IconButton
        variant="tertiary"
        size="small"
        icon="ClockTimeHistoryOutline"
        onPress={handleViewHistory}
        testID="perp-deposit-withdraw-history"
      />
    ),
    [handleViewHistory],
  );

  if (!selectedAccount) {
    return (
      <Page>
        <Page.Body>
          <YStack px="$4" flex={1} justifyContent="center" gap="$4">
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={200} />
            <Skeleton width="100%" height={60} />
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  if (!selectedAccount?.accountId || !selectedAccount?.accountAddress) {
    return (
      <Page>
        <Page.Body>
          <YStack px="$4" flex={1} justifyContent="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              You should select a valid account or create address first
            </SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={intl.formatMessage({
          id:
            actionType === 'deposit'
              ? ETranslations.perp_trade_deposit
              : ETranslations.perp_trade_withdraw,
        })}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        <PerpsProviderMirror>
          <YStack px="$4" flex={1}>
            <DepositWithdrawContent
              params={{ actionType }}
              selectedAccount={selectedAccount}
              onClose={handleClose}
              isMobile
            />
          </YStack>
        </PerpsProviderMirror>
      </Page.Body>
    </Page>
  );
}

export default MobileDepositWithdrawModal;

export async function showDepositWithdrawDialog(
  params: IDepositWithdrawParams,
  dialogInTab: ReturnType<typeof useInTabDialog>,
  intl: IntlShape,
) {
  const selectedAccount = await perpsActiveAccountAtom.get();
  if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
    console.error('[DepositWithdrawModal] Missing required parameters');
    Toast.error({
      title: 'You should select a valid account or create address first',
    });
    return;
  }

  const dialogInTabRef = dialogInTab.show({
    title: getDepositWithdrawTitle(params.actionType, intl),
    renderContent: (
      // In-tab dialogs render through the IN_PAGE_TAB_CONTAINER portal at the
      // TabNavigator root and do not inherit the page/header providers. Mirror the
      // accountSelector context here (as the native perps page does) so any nested
      // useActiveAccount consumer resolves when opened from the web-dapp header pill.
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <YStack flex={1} minHeight={0} height="100%">
            <DepositWithdrawContent
              params={params}
              selectedAccount={selectedAccount}
              hideDesktopTitle
              onClose={() => {
                void dialogInTabRef.close();
              }}
            />
          </YStack>
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
    contentContainerProps: platformEnv.isNative
      ? PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS
      : {
          minHeight: 0,
          flex: 1,
          pb: '$0',
        },
    estimatedContentHeight: platformEnv.isNative
      ? PERP_NATIVE_DEPOSIT_WITHDRAW_ESTIMATED_CONTENT_HEIGHT
      : undefined,
    floatingPanelProps: platformEnv.isNative
      ? undefined
      : {
          height: PERP_DESKTOP_DEPOSIT_WITHDRAW_DIALOG_HEIGHT,
          maxHeight: `min(${PERP_DESKTOP_DEPOSIT_WITHDRAW_DIALOG_HEIGHT}px, calc(100vh - 64px))`,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
        },
    showFooter: false,
    onClose: () => {
      void dialogInTabRef.close();
    },
  });

  return dialogInTabRef;
}
