import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import type { IScrollViewProps, IStackProps } from '@onekeyhq/components';
import {
  Badge,
  Heading,
  Icon,
  Image,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ImageSource } from '@onekeyhq/components/src/primitives/Image/ImageSource';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

import { EChainSelectorPages } from '../../../ChainSelector/router/type';

import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { GetProps } from 'tamagui';

type IDapp = {
  imgUrl: string;
  name: string;
  description: string;
  badge?: {
    children: GetProps<typeof Badge>['children'];
    type: GetProps<typeof Badge>['badgeType'];
  };
};

type IDapps = {
  title?: string;
  data: IDapp[];
}[];

const SuggestedData: IDapps = [
  {
    title: 'Trendy',
    data: [
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1683712871498.0.9361315179110976.0.png',
        name: 'Helio Protocol',
        description:
          'The number one USD over-collateralized destablecoin(decentralized stablecoin)',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1675751433742.0.4873654755473611.0.jpg',
        name: 'mempool',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1700636160725.0.863693819342112.0.jpeg',
        name: 'Celestia',
        description:
          'The first modular blockchain network that securely scales with the number of users.',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1666332676266.0.22271539238874105.0.png',
        name: 'icy.tools',
        description:
          'Use powerful analytics tools to track NFTs across marketplaces and make informed trading decisions.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1691577126061.0.05505372693504218.0.png',
        name: 'OneKey Card',
        description:
          'The all-in-one solution for using your cryptocurrency on popular payment platforms',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1703836878440.0.7900255460408465.0.jpg',
        name: 'Ethscriptions',
        description:
          'Ethscriptions are a new way of creating and sharing digital artifacts on Ethereum using transaction calldata.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1703574531390.0.24617411982774207.0.jpg',
        name: 'Manta Network',
        description: 'Manta Pacific, the Modular L2.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1703574865436.0.15537360694813152.0.jpg',
        name: 'ZKFair',
        description: 'Powered by Polygon CDK & Celestia DA & Lumoz.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/u_b_08eccde0-eb0a-11ec-8629-f114182c14b1.png.png.png.png.png',
        name: 'BakerySwap',
        description:
          "BakerySwap is a decentralized automated market-making (AMM) protocol on Binance Smart Chain(BSC) and the 1st NFT trading platform on BSC - 'Bakery NFT Supermarket'.  BakerySwap is the next iteration of Uniswap.",
      },
    ],
  },
  {
    title: 'Lightning Network',
    data: [
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1705488041902.0.21322678800104078.0.jpg',
        name: 'NoScription',
        description: 'The first NRC-20 asset on Nostr and Lightning Network.',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701837671609.0.37123841997791684.0.jpeg',
        name: 'LightningAssets',
        description:
          'LightningAssets on Nostr. Efficiently send, receive, and trade Taproot Assets and Bitcoin',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701243431057.0.07168402929921691.0.jpeg',
        name: 'Nostr Assets',
        description:
          'LightningFi on Nostr - Send, Receive & Trade Taproot Assets & Bitcoin',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701244506465.0.23841841332788727.0.jpeg',
        name: 'Amboss',
        description: 'Data Analytics for the Lightning Network',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701245225045.0.04514860054866232.0.jpeg',
        name: 'LNCal.com',
        description:
          'LNCal is your public calendar where anyone can book your time and pay you in Bitcoin with no KYC ',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701245384861.0.689339214038253.0.png',
        name: 'sats4likes',
        description: 'Earn Sats for accomplishing tasks',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701245073411.0.3222099428342253.0.jpeg',
        name: 'Lightsats',
        description:
          'Gift sats without losing them.✨ Building a pre-coiner onramp via bitcoin tips/gifts.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701244919519.0.6382074329606169.0.jpeg',
        name: 'Geyser',
        description: 'Open fundraising for creators.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701244767389.0.2535798458920622.0.png',
        name: 'Stacker News',
        description: "It's like Hacker News but we pay you Bitcoin",
      },
    ],
  },
];

const ExploreData: IDapps = [
  {
    data: [
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1705488041902.0.21322678800104078.0.jpg',
        name: 'NoScription',
        description: 'The first NRC-20 asset on Nostr and Lightning Network.',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701837671609.0.37123841997791684.0.jpeg',
        name: 'LightningAssets',
        description:
          'LightningAssets on Nostr. Efficiently send, receive, and trade Taproot Assets and Bitcoin',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701243431057.0.07168402929921691.0.jpeg',
        name: 'Nostr Assets',
        description:
          'LightningFi on Nostr - Send, Receive & Trade Taproot Assets & Bitcoin',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701244506465.0.23841841332788727.0.jpeg',
        name: 'Amboss',
        description: 'Data Analytics for the Lightning Network',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701245225045.0.04514860054866232.0.jpeg',
        name: 'LNCal.com',
        description:
          'LNCal is your public calendar where anyone can book your time and pay you in Bitcoin with no KYC ',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701245384861.0.689339214038253.0.png',
        name: 'sats4likes',
        description: 'Earn Sats for accomplishing tasks',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701245073411.0.3222099428342253.0.jpeg',
        name: 'Lightsats',
        description:
          'Gift sats without losing them.✨ Building a pre-coiner onramp via bitcoin tips/gifts.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701244919519.0.6382074329606169.0.jpeg',
        name: 'Geyser',
        description: 'Open fundraising for creators.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1701244767389.0.2535798458920622.0.png',
        name: 'Stacker News',
        description: "It's like Hacker News but we pay you Bitcoin",
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1683712871498.0.9361315179110976.0.png',
        name: 'Helio Protocol',
        description:
          'The number one USD over-collateralized destablecoin(decentralized stablecoin)',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1675751433742.0.4873654755473611.0.jpg',
        name: 'mempool',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1700636160725.0.863693819342112.0.jpeg',
        name: 'Celestia',
        description:
          'The first modular blockchain network that securely scales with the number of users.',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1666332676266.0.22271539238874105.0.png',
        name: 'icy.tools',
        description:
          'Use powerful analytics tools to track NFTs across marketplaces and make informed trading decisions.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1691577126061.0.05505372693504218.0.png',
        name: 'OneKey Card',
        description:
          'The all-in-one solution for using your cryptocurrency on popular payment platforms',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1703836878440.0.7900255460408465.0.jpg',
        name: 'Ethscriptions',
        description:
          'Ethscriptions are a new way of creating and sharing digital artifacts on Ethereum using transaction calldata.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1703574531390.0.24617411982774207.0.jpg',
        name: 'Manta Network',
        description: 'Manta Pacific, the Modular L2.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/upload_1703574865436.0.15537360694813152.0.jpg',
        name: 'ZKFair',
        description: 'Powered by Polygon CDK & Celestia DA & Lumoz.',
      },
      {
        imgUrl:
          'https://nft.onekey-asset.com/admin/u_b_08eccde0-eb0a-11ec-8629-f114182c14b1.png.png.png.png.png',
        name: 'BakerySwap',
        description:
          "BakerySwap is a decentralized automated market-making (AMM) protocol on Binance Smart Chain(BSC) and the 1st NFT trading platform on BSC - 'Bakery NFT Supermarket'.  BakerySwap is the next iteration of Uniswap.",
      },
    ],
  },
];

const chunkArray = (array: IDapp[], chunkSize: number) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

function ItemsContainer({
  children,
  ...rest
}: {
  children: ReactNode;
} & IStackProps &
  IScrollViewProps) {
  const media = useMedia();

  if (media.gtMd) {
    return <Stack {...rest}>{children}</Stack>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} {...rest}>
      {children}
    </ScrollView>
  );
}

export function SuggestedAndExploreSection() {
  const [isExploreView, setIsExploreView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('new');
  const media = useMedia();
  const navigation = useAppNavigation();

  const handleChainButtonPressed = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.ChainSelector,
    });
  }, [navigation]);

  return (
    <Stack
      p="$5"
      $platform-native={{
        pb: '$16',
      }}
      tag="section"
    >
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading
          selected={!isExploreView}
          onPress={() => setIsExploreView(false)}
        >
          Suggested
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Heading
          selected={isExploreView}
          onPress={() => setIsExploreView(true)}
        >
          Explore
        </DashboardSectionHeader.Heading>
      </DashboardSectionHeader>
      {(isExploreView ? ExploreData : SuggestedData).map(
        ({ title, data }, index) => {
          const getItemsPerChunk = () => {
            if (media.gtMd && media.lg) {
              return 2;
            }

            return 3;
          };

          const dataChunks = chunkArray(
            isExploreView
              ? data
              : data.slice(0, media.gtMd && media.lg ? 8 : 9),
            getItemsPerChunk(),
          );

          return (
            <>
              {title && (
                <Heading
                  size="$headingMd"
                  pt="$2"
                  {...(index !== 0 && {
                    pt: '$5',
                  })}
                >
                  {title}
                </Heading>
              )}
              {isExploreView && (
                <XStack py="$2">
                  <Select
                    title="Categories"
                    items={[
                      {
                        label: 'New',
                        value: 'new',
                      },
                      {
                        label: 'Marketplaces',
                        value: 'marketplaces',
                      },
                      {
                        label: 'Exchanges',
                        value: 'exchanges',
                      },
                      {
                        label: 'Games',
                        value: 'games',
                      },
                    ]}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    renderTrigger={({ label }) => (
                      <XStack
                        mr="$2.5"
                        py="$1.5"
                        px="$2"
                        bg="$bgStrong"
                        borderRadius="$3"
                        userSelect="none"
                        style={{
                          borderCurve: 'continuous',
                        }}
                        hoverStyle={{
                          bg: '$bgStrongHover',
                        }}
                        pressStyle={{
                          bg: '$bgStrongActive',
                        }}
                      >
                        <SizableText size="$bodyMdMedium" px="$1">
                          {label}
                        </SizableText>
                        <Icon
                          name="ChevronDownSmallOutline"
                          size="$5"
                          color="$iconSubdued"
                        />
                      </XStack>
                    )}
                  />
                  <XStack
                    py="$1.5"
                    px="$2"
                    bg="$bgStrong"
                    borderRadius="$3"
                    userSelect="none"
                    style={{
                      borderCurve: 'continuous',
                    }}
                    hoverStyle={{
                      bg: '$bgStrongHover',
                    }}
                    pressStyle={{
                      bg: '$bgStrongActive',
                    }}
                    onPress={handleChainButtonPressed}
                  >
                    <Image w="$5" h="$5">
                      <ImageSource
                        source={{
                          uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
                        }}
                      />
                    </Image>
                    <SizableText size="$bodyMdMedium" px="$1">
                      Bitcoin
                    </SizableText>
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$5"
                      color="$iconSubdued"
                    />
                  </XStack>
                </XStack>
              )}
              <ItemsContainer key={title} mx="$-5">
                <XStack
                  px="$2"
                  $gtMd={{
                    flexDirection: 'column',
                  }}
                >
                  {dataChunks.map((chunk, chunkIndex) => (
                    <Stack
                      key={chunkIndex}
                      $md={{
                        w: '$96',
                      }}
                      $gtMd={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                      }}
                    >
                      {chunk.map(
                        ({ imgUrl, name, description, badge }, itemIndex) => (
                          <XStack
                            key={itemIndex}
                            p="$3"
                            space="$3"
                            alignItems="center"
                            $gtMd={{
                              flexBasis: '50%',
                            }}
                            $gtLg={{
                              flexBasis: '33.3333%',
                            }}
                          >
                            <Image w="$14" h="$14" borderRadius="$3">
                              <Image.Source
                                source={{
                                  uri: imgUrl,
                                }}
                              />
                            </Image>
                            <Stack flex={1}>
                              <XStack alignItems="center">
                                <SizableText
                                  size="$bodyLgMedium"
                                  $gtMd={{
                                    size: '$bodyMdMedium',
                                  }}
                                  numberOfLines={1}
                                >
                                  {name}
                                </SizableText>
                                {badge && (
                                  <Badge
                                    badgeSize="sm"
                                    badgeType={badge.type}
                                    ml="$2"
                                  >
                                    {badge.children}
                                  </Badge>
                                )}
                              </XStack>
                              <SizableText
                                size="$bodyMd"
                                color="$textSubdued"
                                numberOfLines={1}
                                $gtMd={{
                                  size: '$bodySm',
                                  numberOfLines: 2,
                                  whiteSpace: 'break-spaces',
                                }}
                              >
                                {description}
                              </SizableText>
                            </Stack>
                          </XStack>
                        ),
                      )}
                    </Stack>
                  ))}
                </XStack>
              </ItemsContainer>
            </>
          );
        },
      )}
    </Stack>
  );
}
