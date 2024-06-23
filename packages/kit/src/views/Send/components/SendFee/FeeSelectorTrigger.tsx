import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import {
  useIsSinglePresetAtom,
  useSendSelectedFeeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { getFeeLabel } from '@onekeyhq/kit/src/utils/gasFee';

type IProps = ComponentProps<typeof Button> & {
  disabled?: boolean;
  onPress?: () => void;
};

function FeeSelectorTrigger(props: IProps) {
  const intl = useIntl();
  const { disabled, onPress, ...rest } = props;

  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [isSinglePreset] = useIsSinglePresetAtom();

  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      size="small"
      variant="tertiary"
      iconAfter="ChevronGrabberVerOutline"
      {...rest}
    >
      {intl.formatMessage({
        id: getFeeLabel({
          feeType: sendSelectedFee.feeType,
          presetIndex: sendSelectedFee.presetIndex,
          isSinglePreset,
        }),
      })}
    </Button>
  );
}

export { FeeSelectorTrigger };
