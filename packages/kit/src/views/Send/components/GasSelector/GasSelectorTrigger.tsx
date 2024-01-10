import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';

import { useSendSelectedFeeAtom } from '../../../../states/jotai/contexts/send-confirm';
import { getGasIcon, getGasLabel } from '../../../../utils/gasFee';

type IProps = ComponentProps<typeof XStack>;

function GasSelectorTrigger(props: IProps) {
  const intl = useIntl();

  const [sendSelectedFee] = useSendSelectedFeeAtom();

  return (
    <XStack alignItems="center" space="$3" {...props}>
      <XStack alignItems="center" space="$1">
        <SizableText>
          {getGasIcon({
            gasType: sendSelectedFee.feeType,
            gasPresetIndex: sendSelectedFee.presetIndex,
          })}
        </SizableText>
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: getGasLabel({
              gasType: sendSelectedFee.feeType,
              gasPresetIndex: sendSelectedFee.presetIndex,
            }),
          })}
        </SizableText>
      </XStack>
      <Icon
        hoverStyle={{
          color: '$iconActive',
        }}
        name="ChevronGrabberVerOutline"
        size="$6"
        color="$iconSubdued"
      />
    </XStack>
  );
}

export { GasSelectorTrigger };
