import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/SearchInput/UniversalSearchInput';
import { TermsAndPrivacy } from '@onekeyhq/kit/src/views/Onboarding/pages/GetStarted/components/TermsAndPrivacy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

function WebDappEmptyView() {
  const intl = useIntl();
  const [trackAddress, setTrackAddress] = useState('');

  const handleTrackAddress = useCallback(() => {
    if (trackAddress.trim()) {
      console.log('Track address:', trackAddress);
      // TODO: Implement track address logic
      setTrackAddress('');
    }
  }, [trackAddress]);

  const handleAddressSelect = useCallback((address: string) => {
    setTrackAddress(address);
    console.log('Selected address:', address);
    // TODO: Implement track address logic
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setTrackAddress(value);
  }, []);

  // Custom render for search results in WebDapp context - styled like UniversalSearchAddressItem
  const renderResultItem = useCallback(
    (
      item: IUniversalSearchResultItem,
      index: number,
      onSelect: (address: string) => void,
    ) => {
      if (
        item.type === EUniversalSearchType.Address &&
        item.payload.addressInfo
      ) {
        const { addressInfo, network } = item.payload;
        // External address version (like watching address)
        return (
          <ListItem
            key={index}
            onPress={() => onSelect(addressInfo.displayAddress)}
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
    [],
  );

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      width={424}
      alignSelf="center"
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
          borderBottomWidth={StyleSheet.hairlineWidth}
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
            <ListItem
              py="$4"
              px="$5"
              mx="$0"
              bg="$bgSubdued"
              title="OneKey wallet extension"
              subtitle="EVM"
              renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
              drillIn
              onPress={() => {
                console.log('OneKey wallet extension');
              }}
            />
            <ListItem
              py="$4"
              px="$5"
              mx="$0"
              bg="$bgSubdued"
              title="OneKey hardware wallet"
              subtitle={
                <>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.wallet_hardware_wallet_connect_description_1,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.wallet_hardware_wallet_connect_description_2,
                    })}
                  </SizableText>
                </>
              }
              renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
              drillIn
              onPress={() => {
                console.log('OneKey wallet extension');
              }}
            />
          </YStack>
          <TermsAndPrivacy
            contentContainerProps={{
              pb: '$0',
            }}
          />
        </YStack>

        <YStack
          alignItems="center"
          justifyContent="center"
          p="$5"
          pt="$1.5"
          pb="$2"
        >
          <Button size="small" variant="tertiary">
            {intl.formatMessage({
              id: ETranslations.wallet_connect_wallet_more_options,
            })}
          </Button>
        </YStack>
      </YStack>

      <Divider my="$4" width="100%" />

      <YStack py="$4" bg="$bgSubdued" borderRadius="$4" width="$full">
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

        <XStack gap="$2.5" px="$5">
          <UniversalSearchInput
            flex={1}
            searchType="address"
            placeholder={intl.formatMessage({
              id: ETranslations.wallet_track_any_address_placeholder,
            })}
            onAddressSelect={handleAddressSelect}
            onSearchChange={handleSearchChange}
            renderResultItem={renderResultItem}
            popoverContainerProps={{
              mx: '$0',
            }}
            minSearchLength={3}
            debounceMs={300}
            maxResultHeight={240}
          />
          <Button
            size="$4"
            variant="primary"
            minWidth="$24"
            onPress={handleTrackAddress}
          >
            Track
          </Button>
        </XStack>

        <XStack gap="$1.5" px="$5" pb="$0" pt="$3">
          <SizableText size="$bodyMd" color="$textDisabled">
            e.g.
          </SizableText>
          <XStack
            gap="$1"
            py="$0.5"
            px="$2"
            bg="$bgStrong"
            borderRadius="$1"
            alignItems="center"
          >
            <SizableText size="$bodyMdMedium" color="$text">
              EthDev
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              0xde0b29...697bae
            </SizableText>
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export { WebDappEmptyView };
