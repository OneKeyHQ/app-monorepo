import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  LeverageBadge,
  SubtitleBadge,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PriceChangeBadge } from '../../../PriceChangeBadge';
import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { type IMarketToken } from '../../MarketTokenData';

export const useColumnsMobile = (): ITableColumn<IMarketToken>[] => {
  const intl = useIntl();

  return [
    {
      title: null,
      renderTitle: (sortIcon) => (
        <XStack alignItems="center" py="$2" paddingLeft="$5">
          <SizableText color="$textSubdued" size="$bodySmMedium">
            {`${intl.formatMessage({
              id: ETranslations.global_name,
            })} / ${intl.formatMessage({
              id: ETranslations.dexmarket_turnover,
            })}`}
          </SizableText>
          {sortIcon}
        </XStack>
      ),
      dataIndex: 'turnover',
      columnWidth: '50%',
      render: (_, record: IMarketToken) => {
        if (record.perpsCoin) {
          return (
            <XStack
              alignItems="center"
              gap="$3"
              ml="$5"
              userSelect="none"
              minWidth={0}
              overflow="hidden"
            >
              <Token
                size="md"
                borderRadius="$full"
                tokenImageUri={record.tokenImageUri}
                tokenImageUris={record.tokenImageUris}
                fallbackIcon="CryptoCoinOutline"
              />
              <Stack flex={1} minWidth={0}>
                <XStack alignItems="center" gap="$1" minWidth={0}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    maxWidth="$32"
                    flexShrink={1}
                    ellipsizeMode="tail"
                  >
                    {record.symbol}
                  </SizableText>
                  {record.maxLeverage ? (
                    <LeverageBadge leverage={record.maxLeverage} />
                  ) : null}
                  {record.perpsSubtitle ? (
                    <SubtitleBadge subtitle={record.perpsSubtitle} />
                  ) : null}
                </XStack>
                {record.turnover ? (
                  <NumberSizeableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={1}
                    formatter="marketCap"
                    formatterOptions={{ currency: '$' }}
                  >
                    {record.turnover}
                  </NumberSizeableText>
                ) : null}
              </Stack>
            </XStack>
          );
        }
        return (
          <XStack alignItems="center" ml="$5">
            <TokenIdentityItem
              tokenLogoURI={record.tokenImageUri}
              tokenLogoURIs={record.tokenImageUris}
              networkLogoURI={record.networkLogoUri}
              networkId={record.networkId}
              symbol={record.symbol}
              address={record.address}
              showVolume
              volume={record.turnover}
              communityRecognized={record.communityRecognized}
              stock={record.stock}
            />
          </XStack>
        );
      },
      renderSkeleton: () => (
        <XStack alignItems="center" paddingLeft="$5" gap="$3">
          <XStack position="relative">
            <Skeleton width={32} height={32} borderRadius="$full" />
          </XStack>
          <YStack gap="$1">
            <Skeleton width={80} height={16} />
            <Skeleton width={60} height={12} />
          </YStack>
        </XStack>
      ),
    },
    {
      title: null,
      renderTitle: (sortIcon) => (
        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$2"
          py="$2"
          flex={1}
          pr="$5"
        >
          <SizableText
            color="$textSubdued"
            size="$bodySmMedium"
            flexShrink={1}
            textAlign="right"
          >
            {intl.formatMessage({ id: ETranslations.global_price })}
          </SizableText>
          <XStack alignItems="center" justifyContent="center" width="$20">
            <SizableText color="$textSubdued" size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.dexmarket_token_change,
              })}
            </SizableText>
            {sortIcon}
          </XStack>
        </XStack>
      ),
      dataIndex: 'change24h',
      columnWidth: '50%',
      align: 'right',
      render: (_, record: IMarketToken) => (
        <XStack justifyContent="flex-end" alignItems="center" gap="$2" mr="$5">
          <NumberSizeableText
            userSelect="none"
            flexShrink={1}
            numberOfLines={1}
            size="$bodyLgMedium"
            formatter="price"
            formatterOptions={{
              currency: '$',
            }}
          >
            {record.price}
          </NumberSizeableText>
          <PriceChangeBadge change={record.change24h} />
        </XStack>
      ),
      renderSkeleton: () => (
        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$2"
          paddingRight="$5"
        >
          <Skeleton width={80} height={18} />
          <Skeleton width={80} height={18} borderRadius="$2" />
        </XStack>
      ),
    },
  ];
};
