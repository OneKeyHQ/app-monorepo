import { useIntl } from 'react-intl';

import { Icon, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowInfoItem } from '../../../BorrowInfoItem';

import type { IPositionInfoProps } from '../../types';

export function PositionInfo({ type, data }: IPositionInfoProps) {
  const intl = useIntl();

  const title =
    type === 'supply'
      ? intl.formatMessage({ id: ETranslations.defi_my_supply })
      : intl.formatMessage({ id: ETranslations.defi_my_borrow });

  return (
    <BorrowInfoItem title={title} variant="highlight">
      <YStack ai="flex-end">
        <EarnText
          text={data.current?.title}
          size="$headingMd"
          opacity={data.latest ? 0.5 : 1}
        />
        <EarnText
          text={data.current?.description}
          size="$bodySmMedium"
          opacity={data.latest ? 0.5 : 1}
        />
      </YStack>
      {data.latest ? (
        <Icon name="ArrowRightSolid" size="$4" color="$iconDisabled" />
      ) : null}
      {data.latest ? (
        <YStack ai="flex-end">
          <EarnText text={data.latest?.title} size="$headingMd" />
          <EarnText text={data.latest?.description} size="$bodySmMedium" />
        </YStack>
      ) : null}
    </BorrowInfoItem>
  );
}
