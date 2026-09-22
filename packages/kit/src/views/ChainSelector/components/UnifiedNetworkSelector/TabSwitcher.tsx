import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ChainSelectorTestIDs } from '../../testIDs';

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
        label: intl.formatMessage({ id: ETranslations.global_all_networks }),
        value: 'portfolio',
        testID: ChainSelectorTestIDs.unifiedAllNetworksTab,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_single_network }),
        value: 'network',
        testID: ChainSelectorTestIDs.unifiedSingleNetworkTab,
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
