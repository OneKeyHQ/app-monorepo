import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { useSendSelectedFeeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';
import { getFeeLabel } from '@onekeyhq/kit/src/utils/gasFee';

type IProps = ComponentProps<typeof XStack>;

function GasSelectorTrigger(props: IProps) {
  const intl = useIntl();

  const [sendSelectedFee] = useSendSelectedFeeAtom();

  return (
    <XStack alignItems="center" space="$1" {...props}>
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({
          id: getFeeLabel({
            feeType: sendSelectedFee.feeType,
            presetIndex: sendSelectedFee.presetIndex,
          }),
        })}
      </SizableText>
      <Icon
        hoverStyle={{
          color: '$iconActive',
        }}
        name="ChevronGrabberVerOutline"
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  );
}

export { GasSelectorTrigger };
