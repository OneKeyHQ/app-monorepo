import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Input,
  QRCode,
  Select,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  getFontSize,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IRelayChain,
  IRelayCurrency,
  IRelayDepositInfo,
} from '@onekeyhq/shared/types/relay';

interface IRelayDepositContentProps {
  selectedAccount: IPerpsActiveAccountAtom;
}

function RelayDepositContent({ selectedAccount }: IRelayDepositContentProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  const [chains, setChains] = useState<IRelayChain[]>([]);
  const [currencies, setCurrencies] = useState<
    Record<number, IRelayCurrency[]>
  >({});
  const [selectedChainId, setSelectedChainId] = useState<number>(1);
  const [selectedCurrencyAddress, setSelectedCurrencyAddress] =
    useState<string>('');
  const [amount, setAmount] = useState('100');
  const [quoteResult, setQuoteResult] = useState<IRelayDepositInfo | null>(
    null,
  );
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
        icon: chain.icon,
      })),
    [chains],
  );

  const currencyOptions = useMemo(
    () =>
      currentCurrencies.map((c) => ({
        label: c.symbol,
        value: c.address,
        icon: c.logoURI,
      })),
    [currentCurrencies],
  );

  // --- Fetch quote logic ---
  const fetchIdRef = useRef(0);
  const fetchQuote = useCallback(
    async (params: {
      chainId: number;
      currencyAddress: string;
      amt: string;
    }) => {
      if (!recipientAddress) return;
      const amountNum = parseFloat(params.amt);
      if (Number.isNaN(amountNum) || amountNum <= 0) return;

      const id = ++fetchIdRef.current;
      setLoading(true);
      setError('');

      try {
        const result = await backgroundApiProxy.serviceRelay.getRelayQuote({
          originChainId: params.chainId,
          originCurrency: params.currencyAddress,
          recipient: recipientAddress,
          amount: params.amt,
        });
        // Only apply if this is still the latest request
        if (id === fetchIdRef.current) {
          setQuoteResult(result);
        }
      } catch (e: unknown) {
        if (id === fetchIdRef.current) {
          const errorMessage =
            e instanceof Error ? e.message : 'Failed to get quote';
          setError(errorMessage);
          setQuoteResult(null);
        }
      } finally {
        if (id === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [recipientAddress],
  );

  // Load chains on mount, then auto-fetch first quote
  useEffect(() => {
    void (async () => {
      try {
        const result =
          await backgroundApiProxy.serviceRelay.getRelayChains();
        setChains(result.chains);
        setCurrencies(result.currencies);

        // Set defaults
        let defaultChainId = 1;
        let defaultCurrencyAddr = '';

        const ethChain = result.chains.find((c) => c.id === 1);
        if (ethChain) {
          const ethCurrencies = result.currencies[1];
          const usdc = ethCurrencies?.find(
            (c) => c.symbol.toUpperCase() === 'USDC',
          );
          if (usdc) {
            defaultCurrencyAddr = usdc.address;
          } else if (ethCurrencies?.[0]) {
            defaultCurrencyAddr = ethCurrencies[0].address;
          }
        } else if (result.chains[0]) {
          defaultChainId = result.chains[0].id;
          const firstCurrencies = result.currencies[defaultChainId];
          if (firstCurrencies?.[0]) {
            defaultCurrencyAddr = firstCurrencies[0].address;
          }
        }

        setSelectedChainId(defaultChainId);
        setSelectedCurrencyAddress(defaultCurrencyAddr);
        setChainsLoading(false);

        // Auto-fetch quote with defaults
        if (defaultCurrencyAddr) {
          void fetchQuote({
            chainId: defaultChainId,
            currencyAddress: defaultCurrencyAddr,

            amt: '100',
          });
        }
      } catch (e) {
        console.error('Failed to load relay chains', e);
        setChainsLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refetch on amount change (debounced)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAmountChange = useCallback(
    (val: string) => {
      setAmount(val);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (selectedCurrency) {
          void fetchQuote({
            chainId: selectedChainId,
            currencyAddress: selectedCurrency.address,

            amt: val,
          });
        }
      }, 800);
    },
    [fetchQuote, selectedChainId, selectedCurrency],
  );

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

          amt: amount,
        });
      }
    },
    [currencies, amount, fetchQuote],
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

          amt: amount,
        });
      }
    },
    [currentCurrencies, selectedChainId, amount, fetchQuote],
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

  if (chainsLoading) {
    return (
      <YStack gap="$4" py="$4">
        <Skeleton width="100%" height={42} />
        <Skeleton width="100%" height={42} />
        <Skeleton width="100%" height={200} />
      </YStack>
    );
  }

  return (
    <YStack gap="$4">
      {/* Chain selector */}
      <YStack gap="$2">
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
                <XStack alignItems="center" gap="$2">
                  {chain?.icon ? (
                    <Image src={chain.icon} size="$5" borderRadius="$full" />
                  ) : null}
                  <SizableText size="$bodyMd">
                    {chain?.name ?? 'Select Chain'}
                  </SizableText>
                </XStack>
                <Icon name="ChevronDownSmallOutline" size="$4" />
              </XStack>
            );
          }}
        />
      </YStack>

      {/* Token selector */}
      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          Token
        </SizableText>
        <Select
          title="Token"
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
                <XStack alignItems="center" gap="$2">
                  {currency?.logoURI ? (
                    <Image
                      src={currency.logoURI}
                      size="$5"
                      borderRadius="$full"
                    />
                  ) : null}
                  <SizableText size="$bodyMd">
                    {currency?.symbol ?? 'Select Token'}
                  </SizableText>
                </XStack>
                <Icon name="ChevronDownSmallOutline" size="$4" />
              </XStack>
            );
          }}
        />
      </YStack>

      {/* Amount input */}
      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.content__amount })}
        </SizableText>
        <XStack
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$3"
          px="$3"
          bg="$bgSubdued"
          alignItems="center"
          h={42}
        >
          <Input
            flex={1}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            placeholder="100"
            borderWidth={0}
            size="medium"
            fontSize={getFontSize('$bodyMd')}
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: 'transparent',
              p: 0,
            }}
            InputComponentStyle={{
              p: 0,
              bg: 'transparent',
            }}
          />
          <SizableText size="$bodyMd" color="$textSubdued">
            USDC
          </SizableText>
        </XStack>
      </YStack>

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

      {/* Quote Result - QR Code and details */}
      {quoteResult ? (
        <YStack gap="$4" alignItems="center">
          {/* QR Code */}
          <YStack
            bg="$bgApp"
            borderRadius="$3"
            p="$4"
            alignItems="center"
            opacity={loading ? 0.5 : 1}
          >
            <QRCode value={quoteResult.depositAddress} size={200} />
          </YStack>

          {/* Deposit Address */}
          <YStack gap="$2" width="100%">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_address,
              })}
            </SizableText>
            <XStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              px="$3"
              py="$2.5"
              bg="$bgSubdued"
              alignItems="center"
              justifyContent="space-between"
              gap="$2"
            >
              <SizableText
                size="$bodySm"
                color="$text"
                flex={1}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {quoteResult.depositAddress}
              </SizableText>
              <XStack
                cursor="pointer"
                onPress={handleCopyAddress}
                hoverStyle={{ opacity: 0.6 }}
              >
                <Icon name="Copy1Outline" size="$4" color="$iconSubdued" />
              </XStack>
            </XStack>
          </YStack>

          {/* Fee details */}
          <YStack
            gap="$2.5"
            width="100%"
            bg="$bgSubdued"
            borderRadius="$3"
            p="$3"
          >
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Send
              </SizableText>
              <SizableText size="$bodyMd" color="$text">
                {numberFormat(quoteResult.sendAmount, {
                  formatter: 'balance',
                })}{' '}
                {quoteResult.sendSymbol}
              </SizableText>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Receive
              </SizableText>
              <SizableText size="$bodyMd" color="$text">
                {numberFormat(quoteResult.receiveAmount, {
                  formatter: 'balance',
                })}{' '}
                {quoteResult.receiveSymbol}
              </SizableText>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Fees
              </SizableText>
              <SizableText size="$bodyMd" color="$text">
                ${quoteResult.totalFeeUsd}
              </SizableText>
            </XStack>
            {timeEstimateText ? (
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  Est. Time
                </SizableText>
                <SizableText size="$bodyMd" color="$text">
                  {timeEstimateText}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  );
}

export default RelayDepositContent;
