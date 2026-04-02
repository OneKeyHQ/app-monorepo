import { useMemo } from 'react';

import { type ISegmentControlProps } from '@onekeyhq/components';
import { ELightningUnit } from '@onekeyhq/shared/types/lightning';

import { UnitSwitch } from './UnitSwitch';

function LightningUnitSwitch(props: Omit<ISegmentControlProps, 'options'>) {
  const options = useMemo(() => {
    return [
      {
        label: 'BTC',
        value: ELightningUnit.BTC,
      },
      {
        label: 'sats',
        value: ELightningUnit.SATS,
      },
    ];
  }, []);
  return <UnitSwitch {...props} options={options} />;
}

export { LightningUnitSwitch };
