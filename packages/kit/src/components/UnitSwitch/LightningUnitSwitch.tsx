import { useMemo } from 'react';

import { type ISegmentControlProps, SizableText } from '@onekeyhq/components';
import { ELightningUnit } from '@onekeyhq/shared/types/lightning';

import { UnitSwitch } from './UnitSwitch';

function LightningUnitSwitch(props: Omit<ISegmentControlProps, 'options'>) {
  const { value } = props;

  const options = useMemo(() => {
    return [
      {
        label: (
          <SizableText
            size="$bodySm"
            textAlign="center"
            color={value === ELightningUnit.BTC ? '$text' : '$textSubdued'}
          >
            BTC
          </SizableText>
        ),
        value: ELightningUnit.BTC,
      },
      {
        label: (
          <SizableText
            size="$bodySm"
            textAlign="center"
            color={value === ELightningUnit.SATS ? '$text' : '$textSubdued'}
          >
            sats
          </SizableText>
        ),
        value: ELightningUnit.SATS,
      },
    ];
  }, [value]);
  return <UnitSwitch {...props} options={options} />;
}

export { LightningUnitSwitch };
