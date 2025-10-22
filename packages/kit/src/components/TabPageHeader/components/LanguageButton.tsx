import { Select } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useLanguageSelector } from '@onekeyhq/kit/src/views/Setting/hooks';

export interface ILanguageButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
}

export function LanguageButton({ size, iconSize }: ILanguageButtonProps) {
  const { options, value, onChange } = useLanguageSelector();

  return (
    <Select
      title="Language"
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
          title="Language"
        />
      )}
    />
  );
}
