import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IImageSourceProps } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  IconButton,
  Image,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { otherWalletFeeData } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapProviderInfoItemProps {
  fromToken?: ISwapToken;
  isBest?: boolean;
  toToken?: ISwapToken;
  onekeyFee?: number;
  providerIcon: string;
  providerName: string;
  showLock?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
}
interface IProtocolFeeInfo {
  name: string;
  fee: number;
  color: string;
  icon: IImageSourceProps['source'];
  maxFee: number;
}

const SwapProviderInfoItem = ({
  fromToken,
  isBest,
  onekeyFee,
  toToken,
  providerIcon,
  providerName,
  showLock,
  onPress,
  isLoading,
}: ISwapProviderInfoItemProps) => {
  const intl = useIntl();
  const protocolFeeInfoList: IProtocolFeeInfo[] = useMemo(
    () => [
      ...otherWalletFeeData,
      {
        maxFee: 0.875,
        name: 'oneKey',
        fee: onekeyFee ?? 0.3,
        // color: '#202020',
        color: '$bgInverse',
        icon: require('@onekeyhq/kit/assets/logo.png'),
      },
    ],
    [onekeyFee],
  );
  const renderProtocolFeeListItem = useCallback(
    (item: IProtocolFeeInfo) => (
      <XStack gap="$3" alignItems="center">
        <Stack w={20} h={20}>
          <Image source={item.icon} w={16} h={16} />
        </Stack>
        <Stack flex={1}>
          <Stack
            backgroundColor={item.color}
            borderRadius="$full"
            width={`${item.maxFee > 0 ? (item.fee / item.maxFee) * 100 : 0}%`}
            height="$1"
          />
        </Stack>
        <SizableText
          size="$bodySm"
          color={item.name === 'oneKey' ? '$textSuccess' : '$text'}
          textAlign="right"
        >
          {item.fee}%
        </SizableText>
      </XStack>
    ),
    [],
  );
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <XStack>
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          userSelect="none"
          mr="$1"
        >
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_provider,
          })}
        </SizableText>
        <Popover
          title={intl.formatMessage({
            id: ETranslations.provider_ios_popover_onekey_fee,
          })}
          renderTrigger={
            <IconButton
              variant="tertiary"
              size="small"
              icon="InfoCircleOutline"
            />
          }
          renderContent={
            <Stack gap="$5" p="$4">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.provider_ios_popover_onekey_fee_content,
                })}
              </SizableText>
              <Stack gap="$2">
                {protocolFeeInfoList.map((item) =>
                  renderProtocolFeeListItem(item),
                )}
              </Stack>
            </Stack>
          }
        />
      </XStack>

      {isLoading ? (
        <Stack py="$1">
          <Skeleton h="$3" w="$24" />
        </Stack>
      ) : (
        <XStack
          alignItems="center"
          userSelect="none"
          hoverStyle={{
            opacity: 0.5,
          }}
          onPress={onPress}
          cursor={onPress ? 'pointer' : undefined}
        >
          {!providerIcon || !fromToken || !toToken ? null : (
            <>
              {isBest ? (
                <Badge badgeSize="sm" badgeType="success" marginRight="$2">
                  {intl.formatMessage({
                    id: ETranslations.global_best,
                  })}
                </Badge>
              ) : null}
              <Image
                source={{ uri: providerIcon }}
                w="$5"
                h="$5"
                borderRadius="$1"
              />
              <SizableText size="$bodyMdMedium" ml="$1">
                {providerName ?? ''}
              </SizableText>
            </>
          )}
          {showLock ? (
            <Icon name="LockOutline" color="$iconSubdued" ml="$1" size="$5" />
          ) : null}
          {onPress ? (
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
              mr="$-1"
            />
          ) : null}
        </XStack>
      )}
    </XStack>
  );
};
export default SwapProviderInfoItem;
