import { useIntl } from 'react-intl';

import { SegmentedControl } from '@onekeyhq/components';

import { ESendEditFeeTypes } from '../../enums';

export type IEditFeeTabsProps = {
  type: ESendEditFeeTypes;
  onChange: (type: number) => void;
};
export function SendEditFeeTabs({ onChange, type }: IEditFeeTabsProps) {
  const intl = useIntl();
  return (
    <SegmentedControl
      selectedIndex={type === ESendEditFeeTypes.standard ? 0 : 1}
      onChange={onChange}
      values={[
        intl.formatMessage({ id: 'content__standard' }),
        intl.formatMessage({ id: 'content__advanced' }),
      ]}
    />
  );
}
