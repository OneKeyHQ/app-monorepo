import { useIntl } from 'react-intl';

import { Icon, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InfoItemLabel } from './InfoItemLabel';

export interface IAntiMEVToggleProps {
  value: boolean;
}

export function AntiMEVToggle({ value }: IAntiMEVToggleProps) {
  const intl = useIntl();

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.mev_protection_label })}
      />

      <Icon
        name={value ? 'ShieldCheckDoneSolid' : 'ShieldOutline'}
        size="$5"
        color={value ? '$iconSuccess' : '$iconSubdued'}
      />
    </XStack>
  );
}
