import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Select } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useLanguageSelector } from '@onekeyhq/kit/src/views/Setting/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface ILanguageButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
}

export function LanguageButton({ size, iconSize }: ILanguageButtonProps) {
  const { options, value, onChange } = useLanguageSelector();
  const intl = useIntl();
  const title = useMemo(() => {
    return intl.formatMessage({ id: ETranslations.global_language });
  }, [intl]);
  return (
    <Select
      title={title}
      items={options}
      value={value}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      renderTrigger={() => (
        <HeaderIconButton
          size={size}
          icon="GlobusOutline"
          iconSize={iconSize}
          title={title}
        />
      )}
    />
  );
}
