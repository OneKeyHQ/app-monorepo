import { useIntl } from 'react-intl';

import { Switch, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useSwapPanel } from '../hooks/useSwapPanel';

import { InfoItemLabel } from './InfoItemLabel';

export function AntiMEVToggle() {
  const intl = useIntl();

  // Get state from atoms
  const { antiMEV, handleAntiMEVToggle } = useSwapPanel();
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.mev_protection_label })}
      />

      <Switch size="small" value={antiMEV} onChange={handleAntiMEVToggle} />
    </XStack>
  );
}
