import { useMemo } from 'react';

import { RadioFee } from '@onekeyhq/components';
import type { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';

import { FeeSpeedLabel } from '../../components/FeeSpeedLabel';

export type IStandardFeeProps = {
  feeInfoPayload: IFeeInfoPayload | null;
  value: string;
  onChange: (v: string) => void;
};
export function SendEditFeeStandardFormLite({
  feeInfoPayload,
  value,
  onChange,
}: IStandardFeeProps) {
  const gasList = useMemo(
    () => feeInfoPayload?.info?.prices ?? [],
    [feeInfoPayload?.info?.prices],
  );
  const gasItems = useMemo(() => {
    if (!gasList) return [];

    return gasList.map((gas, index) => ({
      value: index.toString(),
      title: <FeeSpeedLabel index={index} alignItems="center" space={2} />,
    }));
  }, [gasList]);

  return (
    <RadioFee
      padding={0}
      pb={6}
      items={gasItems}
      name="standard fee group"
      value={value}
      onChange={onChange}
    />
  );
}
