import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type ITabType = 'portfolio' | 'network';

type ITabSwitcherProps = {
  activeTab: ITabType;
  onTabChange: (tab: ITabType) => void;
};

export function TabSwitcher({ activeTab, onTabChange }: ITabSwitcherProps) {
  const intl = useIntl();

  const handleValueChange = useCallback(
    (value: string | number) => {
      onTabChange(value as ITabType);
    },
    [onTabChange],
  );

  const options = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_portfolio }),
        value: 'portfolio',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_network }),
        value: 'network',
      },
    ],
    [intl],
  );

  return (
    <SegmentControl
      value={activeTab}
      onChange={handleValueChange}
      options={options}
    />
  );
}
