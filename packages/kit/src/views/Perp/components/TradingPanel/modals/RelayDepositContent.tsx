import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
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

  // --- Fetch max quote logic ---
  const fetchIdRef = useRef(0);
  const fetchMaxQuote = useCallback(
    async (params: { chainId: number; currencyAddress: string }) => {
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
        });
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
        const result = await backgroundApiProxy.serviceRelay.getRelayChains();
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

        // Auto-fetch max quote with defaults
        if (defaultCurrencyAddr) {
          void fetchMaxQuote({
            chainId: defaultChainId,
            currencyAddress: defaultCurrencyAddr,
          });
        }
      } catch (e) {
        console.error('Failed to load relay chains', e);
        setChainsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        void fetchMaxQuote({
          chainId,
          currencyAddress: picked.address,
        });
      }
    },
    [currencies, fetchMaxQuote],
  );

  const handleCurrencyChange = useCallback(
    (address: string) => {
      setSelectedCurrencyAddress(address);
      setQuoteResult(null);
      setError('');
      const currency = currentCurrencies.find((c) => c.address === address);
      if (currency) {
        void fetchMaxQuote({
          chainId: selectedChainId,
          currencyAddress: currency.address,
        });
      }
    },
    [currentCurrencies, selectedChainId, fetchMaxQuote],
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
                      {chain?.name ?? 'Select Chain'}
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
                  <XStack alignItems="center" gap="$2" flex={1}>
                    {currency?.logoURI ? (
                      <Image
                        src={currency.logoURI}
                        size="$5"
                        borderRadius="$full"
                      />
                    ) : null}
                    <SizableText size="$bodyMd" numberOfLines={1}>
                      {currency?.symbol ?? 'Select Token'}
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

      {/* Quote Result */}
      {quoteResult ? (
        <YStack gap="$4" opacity={loading ? 0.5 : 1}>
          {/* Deposit Address Card */}
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
          <Divider />

          {/* Fee details */}
          <YStack gap="$2.5" width="100%">
            {selectedCurrency?.address ? (
              <XStack
                justifyContent="space-between"
                alignItems="center"
                gap="$2"
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  Token
                </SizableText>
                <XStack
                  alignItems="center"
                  gap="$1"
                  cursor="pointer"
                  onPress={() => copyText(selectedCurrency.address)}
                  hoverStyle={{ opacity: 0.6 }}
                >
                  <SizableText size="$bodySm" color="$text">
                    {`${selectedCurrency.address.slice(0, 6)}...${selectedCurrency.address.slice(-4)}`}
                  </SizableText>
                  <Icon name="Copy1Outline" size="$3" color="$iconSubdued" />
                </XStack>
              </XStack>
            ) : null}
            {quoteResult.maxReceiveAmount ? (
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$bodySm" color="$textSubdued">
                  Max Received
                </SizableText>
                <SizableText size="$bodySm" color="$text">
                  {numberFormat(quoteResult.maxReceiveAmount, {
                    formatter: 'balance',
                  })}{' '}
                  USDC
                </SizableText>
              </XStack>
            ) : null}
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodySm" color="$textSubdued">
                Fees
              </SizableText>
              <SizableText size="$bodySm" color="$text">
                ${quoteResult.totalFeeUsd}
              </SizableText>
            </XStack>
            {timeEstimateText ? (
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$bodySm" color="$textSubdued">
                  Est. Time
                </SizableText>
                <SizableText size="$bodySm" color="$text">
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
