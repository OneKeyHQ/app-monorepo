import { useIntl } from 'react-intl';

import { SizableText, Switch, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IAntiMEVToggleProps {
  value: boolean;
  onToggle: () => void;
}

export function AntiMEVToggle({ value, onToggle }: IAntiMEVToggleProps) {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.mev_protection_label })}
      </SizableText>
      <Switch size="small" value={value} onChange={onToggle} />
    </XStack>
  );
}
