import { useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IStackProps } from '@onekeyhq/components';
import {
  Badge,
  HeightTransition,
  Icon,
  Image,
  NATIVE_HIT_SLOP,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { Layout } from './utils/Layout';

type IEvaluateOption = 'best' | 'maxReceived';

type IRouteItem = {
  tokens: ITokenProps[];
  label: string;
};

type IRouteRow = IRouteItem[];

type IRouteRows = IRouteRow[];

type ISwapProviderItemType = {
  providerLogoUri: string;
  providerName: string;
  estReceiveAmount: string;
  approved: boolean;
  selected?: boolean;
  evaluates?: IEvaluateOption[];
  estNetworkFee?: string;
  estTime?: string;
  estFee?: string;
  routeContent?: string | IRouteRows;
} & IStackProps;

function SwapProviderItem({
  providerLogoUri,
  providerName,
  estReceiveAmount,
  approved,
  selected,
  evaluates,
  estNetworkFee,
  estTime,
  estFee,
  routeContent,
  ...rest
}: ISwapProviderItemType) {
  const [showRoute, setIsShowRoute] = useState(false);

  const handleRouteButtonPress = () => {
    setIsShowRoute((prev) => !prev);
  };

  const hasBest = evaluates?.includes('best');
  const hasMaxReceived = evaluates?.includes('maxReceived');

  return (
    <Stack
      role="button"
      group="card"
      borderRadius="$4"
      overflow="hidden"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={selected ? '$borderActive' : '$borderSubdued'}
      userSelect="none"
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineOffset: 2,
      }}
      {...rest}
    >
      <XStack
        px="$3.5"
        py="$3"
        bg="$bgSubdued"
        $group-card-hover={{
          bg: '$bgHover',
        }}
        alignItems="center"
      >
        <Stack>
          <Image
            size="$10"
            borderRadius="$2"
            source={{ uri: providerLogoUri }}
            fallback={
              <Image.Fallback
                bg="$bgStrong"
                alignItems="center"
                justifyContent="center"
              >
                <Icon
                  name="Image2MountainsSolid"
                  color="$iconSubdued"
                  size="$10"
                />
              </Image.Fallback>
            }
          />
          {!approved ? (
            <Stack
              p="$0.5"
              borderRadius="$full"
              bg="$bgSubdued"
              position="absolute"
              right="$-1"
              bottom="$-1"
            >
              <Icon size="$4" name="LockOutline" />
            </Stack>
          ) : null}
        </Stack>
        <Stack px="$3" flex={1}>
          <SizableText size="$bodyLgMedium">{estReceiveAmount}</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" pt="$1">
            {providerName}
          </SizableText>
        </Stack>
        {hasBest || hasMaxReceived ? (
          <XStack flexWrap="wrap" justifyContent="flex-end" m={-3} flex={1}>
            {hasBest ? (
              <Stack p={3}>
                <Badge badgeType="success">Overall best</Badge>
              </Stack>
            ) : null}
            {hasMaxReceived ? (
              <Stack p={3}>
                <Badge badgeType="info">Max received</Badge>
              </Stack>
            ) : null}
          </XStack>
        ) : null}
      </XStack>
      <XStack ai="center" gap="$2">
        <SizableText size="$headingLg">Holding</SizableText>
        <Badge badgeType="success" badgeSize="sm">
          <Badge.Text>赚取收益</Badge.Text>
        </Badge>
      </XStack>
      <Stack py="$2" px="$3.5">
        <XStack gap="$3.5" alignItems="center">
          <XStack gap="$1" alignItems="center">
            <Icon name="GasOutline" color="$iconSubdued" size="$4" />
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {estNetworkFee}
            </SizableText>
          </XStack>
          <XStack gap="$1" alignItems="center">
            <Icon
              name="ClockTimeHistoryOutline"
              color="$iconSubdued"
              size="$4"
            />
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {estTime}
            </SizableText>
          </XStack>
          <XStack gap="$1" alignItems="center">
            <Icon name="HandCoinsOutline" color="$iconSubdued" size="$4" />
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {estFee}
            </SizableText>
          </XStack>

          {routeContent ? (
            <XStack
              role="button"
              borderRadius="$2"
              alignItems="center"
              onPress={handleRouteButtonPress}
              ml="auto"
              pr="$1"
              my="$-0.5"
              py="$0.5"
              mr="$-1"
              hitSlop={NATIVE_HIT_SLOP}
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusVisibleStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
            >
              <SizableText pl="$2" size="$bodySmMedium" color="$textSubdued">
                Route
              </SizableText>

              <Stack animation="quick" rotate={showRoute ? '90deg' : '0deg'}>
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </Stack>
            </XStack>
          ) : null}
        </XStack>
        <HeightTransition>
          {showRoute ? (
            <Stack pt="$3.5">
              {typeof routeContent === 'string' ? (
                <SizableText size="$bodySm" color="$textSubdued">
                  {routeContent}
                </SizableText>
              ) : null}

              {Array.isArray(routeContent) ? (
                <>
                  {routeContent.map((row, rowIndex) => (
                    <XStack
                      key={rowIndex}
                      {...(rowIndex !== 0 && { mt: '$3.5' })}
                      justifyContent="space-between"
                    >
                      <XStack
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        h="$3.5"
                        alignItems="flex-end"
                        gap="$1"
                      >
                        {/* generate a array with 10 empty fill */}
                        {new Array(40).fill(null).map((_, index) => (
                          <Stack
                            key={index}
                            h="$0.5"
                            bg="$borderSubdued"
                            flex={1}
                          />
                        ))}
                      </XStack>
                      {row.map((item, itemIndex) => (
                        <Stack key={itemIndex} bg="$bgApp" alignItems="center">
                          <XStack>
                            {item.tokens.map((token, tokenIndex) => (
                              <Token
                                key={tokenIndex}
                                size="sm"
                                {...token}
                                {...(tokenIndex !== 0 && {
                                  ml: '$-2.5',
                                })}
                              />
                            ))}
                          </XStack>
                          <SizableText
                            pt="$1.5"
                            size="$bodySmMedium"
                            color="$textSubdued"
                          >
                            {item.label}
                          </SizableText>
                        </Stack>
                      ))}
                    </XStack>
                  ))}
                </>
              ) : null}
            </Stack>
          ) : null}
        </HeightTransition>
      </Stack>
    </Stack>
  );
}

const BadgeGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Badge"
    elements={[
      {
        title: '默认状态',
        element: (
          <Stack gap="$1">
            <XStack gap="$1">
              <Badge badgeType="default" badgeSize="sm">
                Badge
              </Badge>
              <Badge badgeType="success" badgeSize="sm">
                Badge
              </Badge>
              <Badge badgeType="info" badgeSize="sm">
                Badge
              </Badge>
              <Badge badgeType="warning" badgeSize="sm">
                Badge
              </Badge>
              <Badge badgeType="critical" badgeSize="sm">
                Badge
              </Badge>
            </XStack>
            <XStack gap="$1">
              <Badge badgeType="default" badgeSize="lg">
                Badge
              </Badge>
              <Badge badgeType="success" badgeSize="lg">
                Badge
              </Badge>
              <Badge badgeType="info" badgeSize="lg">
                Badge
              </Badge>
              <Badge badgeType="warning" badgeSize="lg">
                Badge
              </Badge>
              <Badge badgeType="critical" badgeSize="lg">
                Badge
              </Badge>
            </XStack>

            <Stack pt="$10" gap="$4">
              <SwapProviderItem
                providerLogoUri=""
                estReceiveAmount="4.932 USDT"
                providerName="1inch"
                approved={false}
                evaluates={['best', 'maxReceived']}
                estNetworkFee="$0.16"
                estTime="< 1min"
                estFee="$0.16"
                routeContent="The provider does not currently have route information. Your
                funds are safe."
              />
              <SwapProviderItem
                providerLogoUri=""
                estReceiveAmount="4.932 USDTfdsnafidjsnfjsndafjdnsajkfndsjakf"
                providerName="1inch"
                approved={false}
                evaluates={['best', 'maxReceived']}
                estNetworkFee="$0.16"
                estTime="< 1min"
                estFee="$0.16"
                routeContent={[
                  [
                    {
                      tokens: [
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                      ],
                      label: 'Label',
                    },
                    {
                      tokens: [
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                      ],
                      label: 'Label',
                    },
                    {
                      tokens: [
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                      ],
                      label: 'Label',
                    },
                  ],
                  [
                    {
                      tokens: [
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                      ],
                      label: 'Label',
                    },
                    {
                      tokens: [
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                      ],
                      label: 'Label',
                    },
                    {
                      tokens: [
                        {
                          tokenImageUri:
                            'https://uni.onekey-asset.com/static/chain/btc.png',
                        },
                      ],
                      label: 'Label',
                    },
                  ],
                ]}
              />
            </Stack>
          </Stack>
        ),
      },
    ]}
  />
);

export default BadgeGallery;
