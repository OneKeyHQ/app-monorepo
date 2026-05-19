import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Text, TextInput } from 'react-native';

import {
  Divider,
  Icon,
  IconButton,
  Image,
  QRCode,
  Select,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { useTheme } from '@onekeyhq/components/src/hooks/useStyle';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IRelayChain,
  IRelayCurrency,
  IRelayDepositInfo,
} from '@onekeyhq/shared/types/relay';

// Pure utility — format raw numeric string with thousands commas, preserving decimals
function formatWithCommas(raw: string): string {
  if (!raw) return raw;
  const [integer, decimal] = raw.split('.');
  const formattedInt = (integer ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${formattedInt}.${decimal}` : formattedInt;
}

// Extract human-readable message from raw API error (may be JSON)
function parseErrorMessage(raw: string): string {
  try {
    const jsonStart = raw.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string };
      return parsed.message ?? raw;
    }
  } catch {
    // ignore parse errors
  }
  return raw;
}

const DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID =
  'perp-deposit-withdraw-accessory-view';
const DEBOUNCE_MS = 1000;
const DEFAULT_SEND_AMOUNT = '100';
const PERPS_USDC_LOGO =
  'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png';

interface IRelayDepositContentProps {
  selectedAccount: IPerpsActiveAccountAtom;
  isMobile?: boolean;
}

function RelayDepositContent({
  selectedAccount,
  isMobile,
}: IRelayDepositContentProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const theme = useTheme();

  const [chains, setChains] = useState<IRelayChain[]>([]);
  const [currencies, setCurrencies] = useState<
    Record<number, IRelayCurrency[]>
  >({});
  const [selectedChainId, setSelectedChainId] = useState<number>(1);
  const [selectedCurrencyAddress, setSelectedCurrencyAddress] =
    useState<string>('');
  const [quoteResult, setQuoteResult] = useState<IRelayDepositInfo | null>(
    null,
  );
  const [sendAmount, setSendAmount] = useState(DEFAULT_SEND_AMOUNT);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [chainsLoading, setChainsLoading] = useState(true);
  const [error, setError] = useState('');

  const recipientAddress = selectedAccount.accountAddress ?? '';

  const currentCurrencies = useMemo(
    () => currencies[selectedChainId] ?? [],
    [currencies, selectedChainId],
  );

  const selectedCurrency = useMemo(
    () => currentCurrencies.find((c) => c.address === selectedCurrencyAddress),
    [currentCurrencies, selectedCurrencyAddress],
  );

  const chainOptions = useMemo(
    () =>
      chains.map((chain) => ({
        label: chain.name,
        value: chain.id,
        leading: chain.icon ? (
          <Image src={chain.icon} size="$5" borderRadius="$full" />
        ) : undefined,
      })),
    [chains],
  );

  const currencyOptions = useMemo(
    () =>
      currentCurrencies.map((c) => ({
        label: c.symbol,
        value: c.address,
        leading: c.logoURI ? (
          <Image src={c.logoURI} size="$5" borderRadius="$full" />
        ) : undefined,
      })),
    [currentCurrencies],
  );

  // --- Fetch quote logic ---
  const fetchIdRef = useRef(0);
  const fetchQuote = useCallback(
    async (params: {
      chainId: number;
      currencyAddress: string;
      amount: string;
      decimals?: number;
    }) => {
      if (!recipientAddress) return;

      fetchIdRef.current += 1;
      const id = fetchIdRef.current;
      setLoading(true);
      setError('');

      try {
        const result = await backgroundApiProxy.serviceRelay.getRelayMaxQuote({
          originChainId: params.chainId,
          originCurrency: params.currencyAddress,
          recipient: recipientAddress,
          user: recipientAddress,
          refundTo: recipientAddress,
          amount: params.amount,
          decimals: params.decimals,
        });
        if (id === fetchIdRef.current) {
          setQuoteResult(result);
          setSendAmount(result.sendAmount);
          setReceiveAmount(result.receiveAmount);
        }
      } catch (e: unknown) {
        if (id === fetchIdRef.current) {
          const raw = e instanceof Error ? e.message : 'Failed to get quote';
          setError(parseErrorMessage(raw));
          // Keep previous quoteResult so QR code stays visible
        }
      } finally {
        if (id === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [recipientAddress],
  );

  // Debounce amount changes
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  const handleSendAmountChange = useCallback(
    (text: string) => {
      const raw = text.replace(/,/g, '');
      if (!validateAmountInput(raw, selectedCurrency?.decimals)) {
        return;
      }
      fetchIdRef.current += 1;
      setSendAmount(raw);
      setReceiveAmount('');
      setLoading(false);
      setError('');

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const parsed = parseFloat(raw);
        if (!Number.isNaN(parsed) && parsed > 0) {
          void fetchQuote({
            chainId: selectedChainId,
            currencyAddress: selectedCurrencyAddress,
            amount: raw,
            decimals: selectedCurrency?.decimals,
          });
        }
      }, DEBOUNCE_MS);
    },
    [fetchQuote, selectedChainId, selectedCurrencyAddress, selectedCurrency],
  );

  // Load chains and fetch the default quote for the active recipient.
  useEffect(() => {
    let isCancelled = false;
    fetchIdRef.current += 1;
    setQuoteResult(null);
    setError('');

    if (!recipientAddress) {
      setChainsLoading(false);
      return undefined;
    }

    void (async () => {
      setChainsLoading(true);
      try {
        const result = await backgroundApiProxy.serviceRelay.getRelayChains();
        if (isCancelled) return;

        setChains(result.chains);
        setCurrencies(result.currencies);

        // Set defaults
        let defaultChainId = 1;
        let defaultCurrencyAddr = '';
        let defaultCurrencyDecimals: number | undefined;

        const ethChain = result.chains.find((c) => c.id === 1);
        if (ethChain) {
          const ethCurrencies = result.currencies[1];
          const usdc = ethCurrencies?.find(
            (c) => c.symbol.toUpperCase() === 'USDC',
          );
          if (usdc) {
            defaultCurrencyAddr = usdc.address;
            defaultCurrencyDecimals = usdc.decimals;
          } else if (ethCurrencies?.[0]) {
            defaultCurrencyAddr = ethCurrencies[0].address;
            defaultCurrencyDecimals = ethCurrencies[0].decimals;
          }
        } else if (result.chains[0]) {
          defaultChainId = result.chains[0].id;
          const firstCurrencies = result.currencies[defaultChainId];
          if (firstCurrencies?.[0]) {
            defaultCurrencyAddr = firstCurrencies[0].address;
            defaultCurrencyDecimals = firstCurrencies[0].decimals;
          }
        }

        setSelectedChainId(defaultChainId);
        setSelectedCurrencyAddress(defaultCurrencyAddr);
        setChainsLoading(false);

        // Deposit-address quotes use exact-input semantics.
        if (defaultCurrencyAddr) {
          void fetchQuote({
            chainId: defaultChainId,
            currencyAddress: defaultCurrencyAddr,
            amount: DEFAULT_SEND_AMOUNT,
            decimals: defaultCurrencyDecimals,
          });
        }
      } catch (e) {
        if (isCancelled) return;
        const raw = e instanceof Error ? e.message : 'Failed to load chains';
        setError(parseErrorMessage(raw));
        setChainsLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
      fetchIdRef.current += 1;
    };
  }, [fetchQuote, recipientAddress]);

  const handleChainChange = useCallback(
    (chainId: number) => {
      setSelectedChainId(chainId);
      setQuoteResult(null);
      setError('');
      const chainCurrencies = currencies[chainId];
      const usdc = chainCurrencies?.find(
        (c) => c.symbol.toUpperCase() === 'USDC',
      );
      const picked = usdc ?? chainCurrencies?.[0];
      if (picked) {
        setSelectedCurrencyAddress(picked.address);
        void fetchQuote({
          chainId,
          currencyAddress: picked.address,
          amount: DEFAULT_SEND_AMOUNT,
          decimals: picked.decimals,
        });
      }
    },
    [currencies, fetchQuote],
  );

  const handleCurrencyChange = useCallback(
    (address: string) => {
      setSelectedCurrencyAddress(address);
      setQuoteResult(null);
      setError('');
      const currency = currentCurrencies.find((c) => c.address === address);
      if (currency) {
        void fetchQuote({
          chainId: selectedChainId,
          currencyAddress: currency.address,
          amount: DEFAULT_SEND_AMOUNT,
          decimals: currency.decimals,
        });
      }
    },
    [currentCurrencies, selectedChainId, fetchQuote],
  );

  const handleCopyAddress = useCallback(() => {
    if (quoteResult?.depositAddress) {
      copyText(quoteResult.depositAddress);
    }
  }, [quoteResult?.depositAddress, copyText]);

  const timeEstimateText = useMemo(() => {
    if (!quoteResult?.timeEstimate) return '';
    const seconds = quoteResult.timeEstimate;
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `~${minutes}m`;
  }, [quoteResult?.timeEstimate]);

  const hintText = useMemo(() => {
    const maxRaw = quoteResult?.maxReceiveAmount;
    if (maxRaw && parseFloat(maxRaw) > 0) {
      const formatted = numberFormat(maxRaw, {
        formatter: 'marketCap',
        formatterOptions: { currency: '$' },
      });
      return intl.formatMessage(
        { id: ETranslations.perp_relay_deposit_hint_with_max__desc },
        { amount: formatted },
      );
    }
    return intl.formatMessage({
      id: ETranslations.perp_relay_deposit_hint__desc,
    });
  }, [quoteResult?.maxReceiveAmount, intl]);

  if (chainsLoading) {
    return (
      <YStack gap="$4" py="$4">
        <Skeleton width="100%" height={42} />
        <Skeleton width="100%" height={42} />
        <Skeleton width="100%" height={200} />
      </YStack>
    );
  }

  const amountSection = quoteResult ? (
    <YStack gap="$2" opacity={loading ? 0.5 : 1}>
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$bodySm" color="$textSubdued">
          {`${intl.formatMessage({ id: ETranslations.fee_fee })}: $${quoteResult.totalFeeUsd}`}
        </SizableText>
        {timeEstimateText ? (
          <XStack alignItems="center" gap="$1">
            <Icon
              name="ClockTimeHistoryOutline"
              size="$3.5"
              color="$iconSubdued"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              {timeEstimateText}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_send })}
        </SizableText>
        <XStack alignItems="center" gap="$1.5">
          <YStack
            position="relative"
            borderRadius="$2"
            px="$1.5"
            py="$0.5"
            hoverStyle={{ bg: '$bgHover' }}
          >
            <Text
              style={{
                fontSize: 12,
                opacity: 0,
                minWidth: 30,
                color: 'transparent',
              }}
              pointerEvents="none"
            >
              {formatWithCommas(sendAmount) || '0'}
            </Text>
            <TextInput
              accessible
              accessibilityLabel="Send amount"
              inputAccessoryViewID={
                platformEnv.isNativeIOS
                  ? DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID
                  : undefined
              }
              value={formatWithCommas(sendAmount)}
              onChangeText={handleSendAmountChange}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textDisabled.val}
              style={{
                position: 'absolute',
                top: 0,
                left: 6,
                right: 6,
                bottom: 0,
                color: theme.text.val,
                fontSize: 12,
                textAlign: 'right',
                padding: 0,
              }}
            />
          </YStack>
          {selectedCurrency?.logoURI ? (
            <Image
              src={selectedCurrency.logoURI}
              size="$4"
              borderRadius="$full"
            />
          ) : null}
          <SizableText size="$bodySm" color="$text">
            {selectedCurrency?.symbol ?? ''}
          </SizableText>
        </XStack>
      </XStack>

      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_receive })}
        </SizableText>
        <XStack alignItems="center" gap="$1.5">
          <YStack
            position="relative"
            borderRadius="$2"
            px="$1.5"
            py="$0.5"
            hoverStyle={{ bg: '$bgHover' }}
          >
            <Text
              style={{
                fontSize: 12,
                opacity: 0,
                minWidth: 30,
                color: 'transparent',
              }}
              pointerEvents="none"
            >
              {formatWithCommas(receiveAmount) || '0'}
            </Text>
            <TextInput
              accessible
              accessibilityLabel="Receive amount"
              editable={false}
              inputAccessoryViewID={
                platformEnv.isNativeIOS
                  ? DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID
                  : undefined
              }
              value={formatWithCommas(receiveAmount)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textDisabled.val}
              style={{
                position: 'absolute',
                top: 0,
                left: 6,
                right: 6,
                bottom: 0,
                color: theme.textSuccess.val,
                fontSize: 12,
                textAlign: 'right',
                padding: 0,
              }}
            />
          </YStack>
          <Image src={PERPS_USDC_LOGO} size="$4" borderRadius="$full" />
          <SizableText size="$bodySm" color="$textSuccess">
            USDC (Perps)
          </SizableText>
        </XStack>
      </XStack>

      {/* Hint bubble */}
      <YStack mt="$-1.5">
        <XStack justifyContent="center" pl={110} overflow="hidden" h={6}>
          <YStack
            width={10}
            height={10}
            bg="$bgInfoSubdued"
            mt={1}
            transform={[{ rotate: '45deg' }]}
          />
        </XStack>
        <YStack bg="$bgInfoSubdued" borderRadius="$2" px="$3" py="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            {hintText}
          </SizableText>
        </YStack>
      </YStack>
    </YStack>
  ) : null;

  const addressSection = quoteResult ? (
    <YStack gap="$4" opacity={loading ? 0.5 : 1}>
      <YStack borderRadius="$3" p="$4" gap="$4" alignItems="center">
        <QRCode value={quoteResult.depositAddress} size={180} />
      </YStack>

      <YStack gap="$1" py="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_address,
          })}
        </SizableText>
        <XStack alignItems="center" gap="$10">
          <YStack flex={1} width={0}>
            <HighlightAddress address={quoteResult.depositAddress} />
          </YStack>
          <IconButton
            size="small"
            variant="primary"
            icon="Copy1Outline"
            onPress={handleCopyAddress}
          />
        </XStack>
      </YStack>
    </YStack>
  ) : null;

  return (
    <YStack gap="$4">
      {/* Chain & Token selectors */}
      <XStack gap="$2.5">
        <YStack gap="$2" flex={1}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_network })}
          </SizableText>
          <Select
            title={intl.formatMessage({ id: ETranslations.global_network })}
            value={selectedChainId}
            onChange={handleChainChange}
            items={chainOptions}
            renderTrigger={({ value: triggerValue }) => {
              const chain = chains.find((c) => c.id === triggerValue);
              return (
                <XStack
                  borderWidth="$px"
                  borderColor="$borderSubdued"
                  borderRadius="$3"
                  px="$3"
                  bg="$bgSubdued"
                  alignItems="center"
                  justifyContent="space-between"
                  h={42}
                  cursor="pointer"
                  hoverStyle={{ bg: '$bgHover' }}
                >
                  <XStack alignItems="center" gap="$2" flex={1}>
                    {chain?.icon ? (
                      <Image src={chain.icon} size="$5" borderRadius="$full" />
                    ) : null}
                    <SizableText size="$bodyMd" numberOfLines={1}>
                      {chain?.name ??
                        intl.formatMessage({
                          id: ETranslations.global_select_network,
                        })}
                    </SizableText>
                  </XStack>
                  <Icon name="ChevronDownSmallOutline" size="$4" />
                </XStack>
              );
            }}
          />
        </YStack>

        <YStack gap="$2" flex={1}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_relay_token__title })}
          </SizableText>
          <Select
            title={intl.formatMessage({
              id: ETranslations.perp_relay_token__title,
            })}
            value={selectedCurrencyAddress}
            onChange={handleCurrencyChange}
            items={currencyOptions}
            renderTrigger={({ value: triggerValue }) => {
              const currency = currentCurrencies.find(
                (c) => c.address === triggerValue,
              );
              return (
                <XStack
                  borderWidth="$px"
                  borderColor="$borderSubdued"
                  borderRadius="$3"
                  px="$3"
                  bg="$bgSubdued"
                  alignItems="center"
                  justifyContent="space-between"
                  h={42}
                  cursor="pointer"
                  hoverStyle={{ bg: '$bgHover' }}
                >
                  <XStack alignItems="center" gap="$2" flex={1}>
                    {currency?.logoURI ? (
                      <Image
                        src={currency.logoURI}
                        size="$5"
                        borderRadius="$full"
                      />
                    ) : null}
                    <SizableText size="$bodyMd" numberOfLines={1}>
                      {currency?.symbol ??
                        intl.formatMessage({
                          id: ETranslations.dexmarket_select_token,
                        })}
                    </SizableText>
                  </XStack>
                  <Icon name="ChevronDownSmallOutline" size="$4" />
                </XStack>
              );
            }}
          />
        </YStack>
      </XStack>

      {/* Error message */}
      {error ? (
        <SizableText size="$bodySm" color="$red10">
          {error}
        </SizableText>
      ) : null}

      {/* Loading state */}
      {loading && !quoteResult ? (
        <YStack gap="$4" alignItems="center" py="$4">
          <Skeleton width={200} height={200} />
          <Skeleton width="100%" height={40} />
          <Skeleton width="100%" height={120} />
        </YStack>
      ) : null}

      {/* Mobile: amount first, then address; Desktop: address first, then amount */}
      {!isMobile ? (
        <>
          {addressSection}
          {addressSection ? <Divider /> : null}
          {amountSection}
        </>
      ) : (
        <>
          {amountSection}
          {amountSection ? <Divider /> : null}
          {addressSection}
        </>
      )}
    </YStack>
  );
}

export default RelayDepositContent;
