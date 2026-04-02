import { useCallback } from 'react';

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

function TrackAddressHeader() {
  const intl = useIntl();

  return (
    <XStack alignItems="center" gap="$2">
      <Icon name="EyeOutline" size="$5" color="$icon" />
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({
          id: ETranslations.global_track_any_address,
        })}
      </SizableText>
    </XStack>
  );
}

function WebDappEmptyView() {
  const intl = useIntl();
  const media = useMedia();
  const appNavigation = useAppNavigation();

  const isMobileLayout = media.md;

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
        pb: 32,
      }}
      $md={{
        px: '$5',
        width: '100%',
        alignSelf: 'center',
        pt: 20,
        pb: 40,
      }}
    >
      <YStack
        bg="$bgSubdued"
        borderRadius="$4"
        borderWidth={isMobileLayout ? 0 : StyleSheet.hairlineWidth}
        borderColor="$neutral3"
        width="100%"
      >
        <YStack
          p={isMobileLayout ? '0' : '$5'}
          pt={isMobileLayout ? '0' : '$4'}
          bg="$bgApp"
          borderRadius="$4"
          shadowRadius={isMobileLayout ? 0 : '$1'}
          shadowColor="$shadowColor"
          shadowOpacity={0.1}
          borderBottomWidth={isMobileLayout ? 0 : StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          gap={isMobileLayout ? '$3' : '$4'}
          w="$full"
        >
          <XStack alignItems="center" gap="$1.5">
            <Icon name="WalletOutline" size="$5" color="$iconSubdued" />
            <SizableText size="$headingMd" color="$text">
              {intl.formatMessage({ id: ETranslations.global_connect_wallet })}
            </SizableText>
          </XStack>

          <YStack gap={isMobileLayout ? '$3' : '$4'}>
            <OneKeyWalletConnectionOptions showInModal={false} />
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
              cursor="pointer"
              hoverStyle={{
                opacity: 0.8,
                bg: '$transparent',
              }}
              pressStyle={{
                bg: '$transparent',
              }}
              width="100%"
            >
              {intl.formatMessage({
                id: ETranslations.wallet_connect_wallet_more_options,
              })}
            </Button>
          </YStack>
        )}
      </YStack>

      <XStack
        gap="$2"
        py={isMobileLayout ? '$6' : '$8'}
        alignItems="center"
        w="100%"
      >
        <Divider flex={1} borderColor="$borderDisabled" />
        <SizableText
          size="$bodySmMedium"
          color="$textDisabled"
          userSelect="none"
        >
          {intl.formatMessage({
            id: ETranslations.global_or,
          })}
        </SizableText>
        <Divider flex={1} borderColor="$borderDisabled" />
      </XStack>

      <YStack gap="$3" w="100%">
        {isMobileLayout ? <TrackAddressHeader /> : null}
        <YStack
          py="$4"
          pt={isMobileLayout ? '$3' : null}
          bg="$bgSubdued"
          borderRadius="$4"
          width="100%"
        >
          <YStack px="$5" pb="$4">
            {isMobileLayout ? null : <TrackAddressHeader />}
            <SizableText size="$bodyMd" color="$textSubdued" pt="$1">
              {intl.formatMessage({
                id: ETranslations.global_track_any_address_description,
              })}
            </SizableText>
          </YStack>

          <Stack px="$5">
            <Stack flex={1}>
              <UniversalSearchInput
                searchType="address"
                placeholder={intl.formatMessage({
                  id: ETranslations.wallet_track_any_address_placeholder,
                })}
                renderResultItem={renderResultItem}
                popoverContainerProps={{
                  mx: '$0',
                }}
                minSearchLength={3}
                debounceMs={300}
                maxResultHeight={240}
                background="$bgApp"
              />
            </Stack>
          </Stack>

          <XStack gap="$1.5" px="$5" pb="$0" pt="$3" alignItems="center">
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
              cursor="pointer"
              hoverStyle={{
                bg: '$bgStrong',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
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
    </YStack>
  );
}

export { WebDappEmptyView };
