import { useIntl } from 'react-intl';

import { Icon, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowInfoItem } from '../../../BorrowInfoItem';

import type { IHealthFactorInfoProps } from '../../types';

export function HealthFactorInfo({
  data,
  liquidationAt,
}: IHealthFactorInfoProps) {
  const intl = useIntl();

  return (
    <BorrowInfoItem
      title={intl.formatMessage({
        id: ETranslations.defi_health_factor,
      })}
      variant="highlight"
    >
      <YStack ai="flex-end">
        <XStack ai="center" gap="$3">
          <EarnText
            text={data.current?.title}
            size="$headingMd"
            opacity={data.latest ? 0.5 : 1}
          />
          {data.latest ? (
            <>
              <Icon name="ArrowRightSolid" size="$4" color="$iconDisabled" />
              <EarnText text={data.latest?.title} size="$headingMd" />
            </>
          ) : null}
        </XStack>
        <EarnText
          text={
            liquidationAt?.description ?? {
              text: intl.formatMessage({
                id: ETranslations.defi_liquidation_at_less_than_1_00,
              }),
            }
          }
          size="$bodySmMedium"
          color="$textSubdued"
        />
      </YStack>
    </BorrowInfoItem>
  );
}
