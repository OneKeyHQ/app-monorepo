import { useIntl } from 'react-intl';

import { XStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowInfoItem } from '../../../BorrowInfoItem';

import type { IFeeInfoProps } from '../../types';

export function FeeInfo({ type, data }: IFeeInfoProps) {
  const intl = useIntl();

  const title =
    type === 'refundable'
      ? intl.formatMessage({ id: ETranslations.defi_refundable_fee })
      : intl.formatMessage({ id: ETranslations.defi_refundable_fee });

  return (
    <BorrowInfoItem
      title={
        <XStack ai="center" gap="$1.5">
          <EarnText
            text={{
              text: title,
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnTooltip tooltip={data?.tooltip} />
        </XStack>
      }
    >
      <XStack>
        <EarnText text={data?.title} />
        <EarnText text={data?.description} />
      </XStack>
    </BorrowInfoItem>
  );
}
