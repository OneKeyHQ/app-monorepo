import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Carousel,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

function WalletBanner() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  const intl = useIntl();

  const { result: banners } = usePromiseResult(
    async () => {
      if (isNil(account?.id)) {
        return [];
      }
      return backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
        accountId: account.id,
      });
    },
    [account?.id],
    {
      initResult: [],
    },
  );

  const { result: filteredBanners } = usePromiseResult(
    async () => {
      if (banners.length === 0) {
        return banners;
      }
      return banners;
    },
    [banners],
    {
      initResult: [],
    },
  );

  const handleDismiss = useCallback((item: IWalletBanner) => {
    console.log('handleDismiss', item);
  }, []);
  const handleClick = useCallback((item: IWalletBanner) => {
    console.log('handleClick', item);
  }, []);

  if (filteredBanners.length === 0) {
    return null;
  }

  return (
    <Stack p="$5">
      <Carousel
        data={filteredBanners}
        autoPlayInterval={3800}
        containerStyle={{
          height: 96,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$borderSubdued',
          borderRadius: '$4',
          overflow: 'hidden',
        }}
        renderItem={({ item }: { item: IWalletBanner }) => {
          return (
            <XStack bg="$bgApp" px="$4" flex={1} jc="space-between" ai="center">
              <XStack gap="$5" alignItems="center">
                <Image
                  size="$16"
                  borderRadius="$2.5"
                  source={{ uri: item.src }}
                  fallback={
                    <Image.Fallback
                      w="100%"
                      h="100%"
                      borderRadius="$2.5"
                      bg="$bgStrong"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Icon
                        name="ImageSquareWavesOutline"
                        color="$iconDisabled"
                      />
                    </Image.Fallback>
                  }
                />
                <YStack gap="$0.5">
                  <SizableText
                    size="$bodyLgMedium"
                    $md={{ maxWidth: 0, width: 0 }}
                  >
                    {item.title}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    maxWidth="$40"
                    $md={{ maxWidth: 0, width: 0 }}
                    numberOfLines={2}
                    flexShrink={1}
                  >
                    {item.description}
                  </SizableText>
                </YStack>
              </XStack>
              <XStack gap="$5">
                {item.closeable ? (
                  <Button
                    variant="tertiary"
                    onPress={() => handleDismiss(item)}
                  >
                    {intl.formatMessage({ id: ETranslations.explore_dismiss })}
                  </Button>
                ) : null}
                <Button variant="primary" onPress={() => handleClick(item)}>
                  {item.button}
                </Button>
              </XStack>
            </XStack>
          );
        }}
      />
    </Stack>
  );
}

export default WalletBanner;
