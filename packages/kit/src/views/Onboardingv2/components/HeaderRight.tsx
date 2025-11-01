import { useIntl } from 'react-intl';

import { Button, Select } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useLanguageSelector } from '../../Setting/hooks';

function HeaderRightLanguageSelector() {
  const intl = useIntl();
  const { options, value, onChange } = useLanguageSelector();

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.global_language })}
      items={options}
      value={value}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <Button size="small" icon="GlobusOutline" variant="tertiary" ml="auto">
          {label}
        </Button>
      )}
    />
  );
}

export const renderOnboardingHeaderRight = () => {
  return <HeaderRightLanguageSelector />;
};
