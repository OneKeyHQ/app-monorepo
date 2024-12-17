import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  Image,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IImageSourceProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { otherWalletFeeData } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

interface IProtocolFeeInfo {
  name: string;
  fee: number;
  color: string;
  icon: IImageSourceProps['source'];
  maxFee: number;
}

export function SwapServiceFeeOverview({
  onekeyFee,
}: {
  onekeyFee: number | undefined;
}) {
  const intl = useIntl();
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

  const serviceFee = onekeyFee ?? 0.3;

  const protocolFeeInfoList: IProtocolFeeInfo[] = useMemo(
    () => [
      ...otherWalletFeeData,
      {
        maxFee: 0.875,
        name: 'oneKey',
        fee: serviceFee,
        // color: '#202020',
        color: '$bgInverse',
        icon: require('@onekeyhq/kit/assets/logo.png'),
      },
    ],
    [serviceFee],
  );
  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.provider_ios_popover_onekey_fee,
      })}
      renderTrigger={
        <IconButton variant="tertiary" size="small" icon="InfoCircleOutline" />
      }
      renderContent={
        <Stack gap="$4" p="$4">
          <Stack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.provider_ios_popover_onekey_fee_content,
                },
                { num: `${serviceFee}%` },
              )}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.provider_ios_popover_onekey_fee_content_2,
                },
                { num: `${serviceFee}%` },
              )}
            </SizableText>
          </Stack>
          <Stack gap="$2">
            {protocolFeeInfoList.map((item) => renderProtocolFeeListItem(item))}
          </Stack>
        </Stack>
      }
    />
  );
}
