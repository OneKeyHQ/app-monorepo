import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/SearchInput/UniversalSearchInput';
import { OneKeyWalletConnectionOptions } from '@onekeyhq/kit/src/components/WebDapp/OneKeyWalletConnectionOptions';
import { TermsAndPrivacy } from '@onekeyhq/kit/src/views/Onboarding/pages/GetStarted/components/TermsAndPrivacy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import useAppNavigation from '../../hooks/useAppNavigation';
import { urlAccountNavigation } from '../../views/Home/pages/urlAccount/urlAccountUtils';

const ETH_DEV_ADDRESS = '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae';

function WebDappEmptyView() {
  const intl = useIntl();
  const media = useMedia();
  const appNavigation = useAppNavigation();
  const [searchResults, setSearchResults] = useState<
    IUniversalSearchResultItem[]
  >([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const isMobileLayout = media.md;

  const isTrackEnabled = useMemo(() => {
    if (Array.isArray(searchResults) && searchResults.length > 0) {
      return true;
    }
    return false;
  }, [searchResults]);

  const handleTrackAddress = useCallback(async () => {
    if (searchResults.length === 0) {
      return;
    }

    // Use first search result if available, otherwise use input text
    const firstResult = searchResults[0];
    if (
      firstResult?.type === EUniversalSearchType.Address &&
      firstResult.payload.addressInfo
    ) {
      const { network, addressInfo } = firstResult.payload;
      if (network && addressInfo) {
        await urlAccountNavigation.pushOrReplaceUrlAccountPage(appNavigation, {
          address: addressInfo.displayAddress,
          networkId: network.id,
        });
      }
    }
  }, [searchResults, appNavigation]);

  const handleResultsChange = useCallback(
    (results: IUniversalSearchResultItem[]) => {
      setSearchResults(results);
    },
    [],
  );

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsSearchLoading(loading);
  }, []);

  const handleShowMoreOptions = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWalletOptions,
      params: {
        defaultTab: 'others',
      },
    });
  }, [appNavigation]);

  // Handle address press directly - navigate to URL account page
  const handleAddressPressFromResult = useCallback(
    async (item: IUniversalSearchResultItem) => {
      if (
        item.type === EUniversalSearchType.Address &&
        item.payload.addressInfo
      ) {
        const { network, addressInfo } = item.payload;
        if (!network || !addressInfo) return;

        await urlAccountNavigation.pushOrReplaceUrlAccountPage(appNavigation, {
          address: addressInfo.displayAddress,
          networkId: network.id,
        });
      }
    },
    [appNavigation],
  );

  // Custom render for search results in WebDapp context - styled like UniversalSearchAddressItem
  const renderResultItem = useCallback(
    (item: IUniversalSearchResultItem, index: number) => {
      if (
        item.type === EUniversalSearchType.Address &&
        item.payload.addressInfo
      ) {
        const { addressInfo, network } = item.payload;
        return (
          <ListItem
            key={index}
            onPress={() => handleAddressPressFromResult(item)}
            renderAvatar={<NetworkAvatar networkId={network?.id} size="$10" />}
            title={network?.shortname || network?.name}
            subtitle={accountUtils.shortenAddress({
              address: addressInfo.displayAddress,
            })}
          />
        );
      }
      return null;
    },
    [handleAddressPressFromResult],
  );

  return (
    <YStack
      flex={1}
      alignItems="center"
      $gtMd={{
        width: 424,
        alignSelf: 'center',
        pt: 80,
      }}
      $md={{
        mx: '$5',
        width: 'auto',
        pt: 20,
      }}
    >
      <YStack
        bg="$bgSubdued"
        borderRadius="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        width="100%"
      >
        <YStack
          p="$5"
          pt="$4"
          bg="$bgApp"
          borderRadius="$4"
          shadowRadius="$1"
          shadowColor="$shadowColor"
          shadowOpacity={0.1}
          borderBottomWidth={isMobileLayout ? 0 : StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          gap="$4"
          w="$full"
        >
          <XStack alignItems="center" gap="$1.5">
            <Icon name="WalletOutline" size="$5" color="$iconSubdued" />
            <SizableText size="$headingMd" color="$text">
              {intl.formatMessage({ id: ETranslations.global_connect_wallet })}
            </SizableText>
          </XStack>

          <YStack gap="$4">
            <OneKeyWalletConnectionOptions />
          </YStack>
          <TermsAndPrivacy
            contentContainerProps={{
              pb: '$0',
            }}
          />
        </YStack>

        {isMobileLayout ? null : (
          <YStack
            alignItems="center"
            justifyContent="center"
            p="$5"
            pt="$1.5"
            pb="$2"
          >
            <Button
              size="small"
              variant="tertiary"
              onPress={handleShowMoreOptions}
            >
              {intl.formatMessage({
                id: ETranslations.wallet_connect_wallet_more_options,
              })}
            </Button>
          </YStack>
        )}
      </YStack>

      <Divider my="$4" width="100%" />

      <YStack py="$4" bg="$bgSubdued" borderRadius="$4" width="100%">
        <YStack px="$5" pb="$4">
          <XStack alignItems="center" gap="$2">
            <Icon name="EyeOutline" size="$5" color="$icon" />
            <SizableText size="$headingMd" color="$text">
              {intl.formatMessage({
                id: ETranslations.global_track_any_address,
              })}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMd" color="$textSubdued" pt="$1">
            {intl.formatMessage({
              id: ETranslations.global_track_any_address_description,
            })}
          </SizableText>
        </YStack>

        <Stack px="$5">
          <XStack gap="$2" alignItems="stretch">
            <Stack flex={1}>
              <UniversalSearchInput
                searchType="address"
                placeholder={intl.formatMessage({
                  id: ETranslations.wallet_track_any_address_placeholder,
                })}
                onResultsChange={handleResultsChange}
                onLoadingChange={handleLoadingChange}
                renderResultItem={renderResultItem}
                popoverContainerProps={{
                  mx: '$0',
                }}
                minSearchLength={3}
                debounceMs={300}
                maxResultHeight={240}
              />
            </Stack>
            <Button
              size="$4"
              variant="primary"
              onPress={handleTrackAddress}
              minWidth={80}
              disabled={!isTrackEnabled ? !isSearchLoading : null}
              loading={isSearchLoading}
            >
              Track
            </Button>
          </XStack>
        </Stack>

        <XStack gap="$1.5" px="$5" pb="$0" pt="$3">
          <SizableText size="$bodyMd" color="$textDisabled">
            {intl.formatMessage({
              id: ETranslations.global_eg,
            })}
          </SizableText>
          <Badge
            gap="$1"
            py="$0.5"
            px="$2"
            bg="$bgStrong"
            borderRadius="$1"
            alignItems="center"
            onPress={() => {
              void urlAccountNavigation.pushOrReplaceUrlAccountPage(
                appNavigation,
                {
                  address: ETH_DEV_ADDRESS,
                  networkId: getNetworkIdsMap().eth,
                },
              );
            }}
          >
            <SizableText size="$bodyMdMedium" color="$text">
              EthDev
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {accountUtils.shortenAddress({
                address: ETH_DEV_ADDRESS,
                trailingLength: 6,
                leadingLength: 4,
              })}
            </SizableText>
          </Badge>
        </XStack>
      </YStack>
    </YStack>
  );
}

export { WebDappEmptyView };
