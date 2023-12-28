import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Text, XStack } from '@onekeyhq/components';

import {
  useSelectedPresetGasIndexAtom,
  useSendGasTypeAtom,
} from '../../../../states/jotai/contexts/send-confirm';
import { getGasIcon, getGasLabel } from '../../../../utils/gasFee';

type IProps = ComponentProps<typeof XStack>;

function GasSelectorTrigger(props: IProps) {
  const intl = useIntl();
  const [sendGasType] = useSendGasTypeAtom();
  const [selectedGasPresetIndex] = useSelectedPresetGasIndexAtom();

  return (
    <XStack alignItems="center" space="$3" {...props}>
      <XStack alignItems="center">
        <Text>
          {getGasIcon({
            gasType: sendGasType,
            gasPresetIndex: selectedGasPresetIndex,
          })}
        </Text>
        <Text variant="$bodyLg">
          {intl.formatMessage({
            id: getGasLabel({
              gasType: sendGasType,
              gasPresetIndex: selectedGasPresetIndex,
            }),
          })}
        </Text>
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
