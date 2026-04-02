import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
  useTheme,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import {
  MarketNormalTokenList,
  MarketWatchlistTokenList,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import { useMarketTokenSelectorConfigAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS,
  TOKEN_SELECTOR_POLLING_INTERVAL,
} from './constants';
import { MarketSearchTokenTable } from './MarketSearchTokenTable';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';
import { useLiveTokenOverride } from './useLiveTokenOverride';

function BaseMarketTokenSelectorContent() {
  const intl = useIntl();
  const theme = useTheme();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode, spotNetworkId } = selectorConfig;

  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(isWatchlistMode ? undefined : spotNetworkId || undefined);
  const [startListSelect, setStartListSelect] = useState(isWatchlistMode);

  const [searchValue, setSearchValue] = useState('');
  const searchValueDebounce = useDebounce(searchValue, 500);
  const { searchLoading, searchTokenList } =
    useSwapProTokenSearch(searchValueDebounce);

  const liveTokenOverride = useLiveTokenOverride();

  const handleNetworkIdChange = useCallback(
    (nextNetworkId: string) => {
      setStartListSelect(false);
      setSelectedNetworkId(nextNetworkId);
      setSelectorConfig((prev) => ({
        ...prev,
        isWatchlistMode: false,
        spotNetworkId: nextNetworkId,
      }));
    },
    [setSelectorConfig],
  );

  const handleStartListSelect = useCallback(() => {
    setStartListSelect(true);
    setSelectedNetworkId(undefined);
    setSelectorConfig((prev) => ({ ...prev, isWatchlistMode: true }));
  }, [setSelectorConfig]);

  const navigateToTokenDetail = useCallback(
    (token: {
      address: string;
      networkId: string;
      isNative?: boolean;
      perpsCoin?: string;
    }) => {
      if (token.perpsCoin) {
        void closePopover?.();
        navigateToPerps(token.perpsCoin);
        return;
      }

      navigateToMarketTokenDetail(token, {
        tokenDetailActions,
        beforeNavigate: () => void closePopover?.(),
      });
    },
    [tokenDetailActions, closePopover, navigateToPerps],
  );

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
      navigateToTokenDetail(item);
    },
    [navigateToTokenDetail],
  );

  return (
    <YStack p="$3" gap="$1" height={600}>
      <Stack px="$2" pb="$2">
        <SearchBar
          autoFocus
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_asset,
          })}
          value={searchValue}
          onChangeText={setSearchValue}
        />
      </Stack>

      {searchValueDebounce ? (
        <MarketSearchTokenTable
          isLoading={searchLoading}
          items={searchTokenList}
          onPress={handleSelectToken}
          rowBg="$bg"
        />
      ) : (
        <>
          <MarketTokenListNetworkSelector
            selectedNetworkId={selectedNetworkId}
            onSelectNetworkId={handleNetworkIdChange}
            placement="bottom-start"
            startListSelect={startListSelect}
            onStartListSelect={handleStartListSelect}
            borderColor="$neutral3"
            gradientBgColor={theme.bg.val}
          />

          <Stack flex={1} display={startListSelect ? 'flex' : 'none'}>
            <MarketWatchlistTokenList
              onItemPress={handleSelectToken}
              hidePerps
              hiddenDesktopColumns={TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS}
              liveTokenOverride={liveTokenOverride}
              pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
              rowBg="$bg"
            />
          </Stack>
          <Stack flex={1} display={startListSelect ? 'none' : 'flex'}>
            <MarketNormalTokenList
              onItemPress={handleSelectToken}
              networkId={selectedNetworkId}
              hiddenDesktopColumns={TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS}
              liveTokenOverride={liveTokenOverride}
              pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
              rowBg="$bg"
            />
          </Stack>
        </>
      )}
    </YStack>
  );
}

// Only render content when open to avoid stale state on reopen
function MarketTokenSelectorContent({ isOpen }: { isOpen: boolean }) {
  return isOpen ? <BaseMarketTokenSelectorContent /> : null;
}

const MarketTokenSelectorContentMemo = memo(MarketTokenSelectorContent);

function BaseMarketTokenSelector() {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { tokenDetail, networkId } = useTokenDetail();

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId,
  });

  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};
  const logoUrlsCacheKey = useMemo(() => logoUrls?.join('|') ?? '', [logoUrls]);
  const stableLogoUrlsRef = useRef(logoUrls);
  const stableLogoUrlsKeyRef = useRef(logoUrlsCacheKey);

  if (stableLogoUrlsKeyRef.current !== logoUrlsCacheKey) {
    stableLogoUrlsRef.current = logoUrls;
    stableLogoUrlsKeyRef.current = logoUrlsCacheKey;
  }

  const stableLogoUrls = stableLogoUrlsRef.current;

  // Keep the popover element stable during token detail polling.
  // `logoUrls` is often returned as a fresh array on each refresh even when
  // the actual content is unchanged, which would otherwise recreate the
  // popover tree and cause visible jitter while it is open.
  const content = useMemo(
    () => (
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_search })}
        floatingPanelProps={{ width: 800 }}
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-start"
        renderTrigger={
          // eslint-disable-next-line props-checker/validator -- Popover injects the trigger press handler.
          <XStack
            gap="$2"
            alignItems="center"
            cursor="pointer"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
          >
            <Token
              size="md"
              tokenImageUri={logoUrl}
              tokenImageUris={stableLogoUrls}
              networkImageUri={effectiveNetworkLogoUri}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText
              size="$heading2xl"
              color="$text"
              numberOfLines={1}
              ellipsizeMode="tail"
              maxWidth="$48"
              flexShrink={1}
            >
              {symbol}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        }
        renderContent={({ isOpen: isOpenProp }) => (
          <MarketTokenSelectorContentMemo isOpen={isOpenProp ?? false} />
        )}
      />
    ),
    [isOpen, symbol, logoUrl, stableLogoUrls, effectiveNetworkLogoUri, intl],
  );

  return content;
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
