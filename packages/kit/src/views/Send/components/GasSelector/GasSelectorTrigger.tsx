import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import {
  useSelectedPresetGasIndexAtom,
  useSendGasTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';
import { getGasIcon, getGasLabel } from '@onekeyhq/kit/src/utils/gasFee';

type IProps = ComponentProps<typeof XStack>;

function GasSelectorTrigger(props: IProps) {
  const intl = useIntl();
  const [sendGasType] = useSendGasTypeAtom();
  const [selectedGasPresetIndex] = useSelectedPresetGasIndexAtom();

  return (
    <XStack alignItems="center" space="$3" {...props}>
      <XStack alignItems="center">
        <SizableText>
          {getGasIcon({
            gasType: sendGasType,
            gasPresetIndex: selectedGasPresetIndex,
          })}
        </SizableText>
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: getGasLabel({
              gasType: sendGasType,
              gasPresetIndex: selectedGasPresetIndex,
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
