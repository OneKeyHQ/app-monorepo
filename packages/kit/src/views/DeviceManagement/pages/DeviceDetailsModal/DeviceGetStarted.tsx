import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

import {
  Button,
  Carousel,
  Divider,
  Icon,
  Image,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const imageItems = [
  {
    title: 'How to set up your OneKey hardware Wallet?',
    url: 'https://www.youtube.com/watch?v=YywATRDNlpU',
    image: 'https://img.youtube.com/vi/YywATRDNlpU/mqdefault.jpg',
  },
  {
    title:
      'Connect your OneKey wallets to OneKey App (desktop version) via bluetooth',
    url: 'https://www.youtube.com/watch?v=QFzfTrArq-A',
    image: 'https://img.youtube.com/vi/QFzfTrArq-A/mqdefault.jpg',
  },
  {
    title: 'How to Set up OneKey Hardware Wallets as your 2FA Device',
    url: 'https://www.youtube.com/watch?v=86F4YLL39ck',
    image: 'https://img.youtube.com/vi/86F4YLL39ck/mqdefault.jpg',
  },
  {
    title: 'EP1: Passphrase and Hidden Wallets on OneKey Hardware Wallets',
    url: 'https://www.youtube.com/watch?v=NIh2ust5vDE',
    image: 'https://img.youtube.com/vi/NIh2ust5vDE/mqdefault.jpg',
  },
  {
    title:
      'Set up your OneKey Hardware Wallet: PIN Number and Recovery Phrases Explained',
    url: 'https://www.youtube.com/watch?v=s-0NjFAXgww',
    image: 'https://img.youtube.com/vi/s-0NjFAXgww/mqdefault.jpg',
  },
  // test line
  {
    title:
      'How to set up your OneKey hardware Wallet? How to set up your OneKey hardware Wallet?',
    url: 'https://www.youtube.com/watch?v=YywATRDNlpU',
    image: 'https://img.youtube.com/vi/YywATRDNlpU/mqdefault.jpg',
  },
  {
    title: 'How to set up',
    url: 'https://www.youtube.com/watch?v=YywATRDNlpU',
    image: 'https://img.youtube.com/vi/YywATRDNlpU/mqdefault.jpg',
  },
];
const fqaCenterUrl = 'https://help.onekey.so/collections/13034407';
const faqItems = [
  {
    title: 'Deposit cryptos to OneKey',
    url: 'https://help.onekey.so/articles/11461136',
  },
  {
    title: 'Import and Remove wallets in OneKey App',
    url: 'https://help.onekey.so/articles/11461140',
  },
  {
    title: 'Swap and bridge cryptos in OneKey App',
    url: 'https://help.onekey.so/articles/11461146',
  },
  {
    title: 'Trade perpetuals in OneKey App',
    url: 'https://help.onekey.so/articles/12071735',
  },
  {
    title: 'Stake and earn cryptos in OneKey App',
    url: 'https://help.onekey.so/articles/11461149',
  },
  // test line
  {
    title:
      'How to set up your OneKey hardware How to set up your OneKey hardware Wallet?',
    url: 'https://www.youtube.com/watch?v=YywATRDNlpU',
  },
];

function DeviceGetStarted() {
  const intl = useIntl();

  const handleOpen = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <YStack gap="$4">
      <XStack gap="$3" alignItems="center">
        <Icon name="BookOpenOutline" size="$5" color="$icon" />
        <SizableText size="$headingMd" color="$text">
          {intl.formatMessage({ id: ETranslations.global_get_started })}
        </SizableText>
      </XStack>

      <YStack gap="$3">
        <Carousel
          data={imageItems}
          autoPlayInterval={5000}
          renderItem={({ item }) => (
            <YStack
              width={320}
              borderRadius="$3"
              overflow="hidden"
              position="relative"
              bg="$bgStrong"
              onPress={() => handleOpen(item.url)}
              pressStyle={{ scale: 0.98 }}
            >
              <Stack height={180}>
                <Image
                  source={{ uri: item.image }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <LinearGradient
                  position="absolute"
                  left={0}
                  right={0}
                  top={0}
                  bottom={0}
                  colors={['rgba(6, 10, 14, 0.15)', 'rgba(6, 10, 14, 0.65)']}
                />
                <Stack
                  position="absolute"
                  left={0}
                  right={0}
                  top={0}
                  bottom={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon name="PlayCircleSolid" size="$14" color="$whiteA12" />
                </Stack>
              </Stack>
              <XStack px="$3" py="$3" bg="$bgStrong" ai="center" jc="center">
                <SizableText
                  size="$headingSm"
                  color="$text"
                  textAlign="center"
                  numberOfLines={2}
                  minHeight="$9"
                >
                  {item.title}
                </SizableText>
              </XStack>
            </YStack>
          )}
          pageWidth="100%"
          maxPageWidth={320}
          showPaginationButton
          paginationContainerStyle={{
            paddingVertical: 12,
            gap: 8,
            justifyContent: 'center',
          }}
          activeDotStyle={{
            width: 20,
            height: 8,
            borderRadius: 999,
            bg: '$text',
          }}
          dotStyle={{
            width: 8,
            height: 8,
            borderRadius: 999,
            bg: '$borderSubdued',
            opacity: 0.45,
          }}
        />
      </YStack>

      <Stack>
        <XStack jc="space-between" ai="center" py="$2.5">
          <SizableText size="$headingSm" color="$text">
            {intl.formatMessage({ id: ETranslations.global_faqs })}
          </SizableText>
          <Button
            size="small"
            variant="tertiary"
            title={intl.formatMessage({ id: ETranslations.global_learn_more })}
            iconAfter="OpenOutline"
            onPress={() => handleOpen(fqaCenterUrl)}
            cursor="pointer"
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </Button>
        </XStack>
        <Divider />
        {faqItems.map((item) => (
          <Stack
            cursor="pointer"
            py="$1"
            my="$1"
            mx="$0"
            onPress={() => handleOpen(item.url)}
            key={item.title}
          >
            <SizableText size="$bodyMd" color="$text">
              {item.title}
            </SizableText>
          </Stack>
        ))}
      </Stack>
    </YStack>
  );
}

export default DeviceGetStarted;
