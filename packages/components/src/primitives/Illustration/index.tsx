import { useMemo } from 'react';

import { useThemeName } from '../../hooks/useStyle';
import { Icon } from '../Icon';
import ICON_CONFIG from '../Icon/Icons';

import type { IIconProps, IKeyOfIcons } from '../Icon';

// Illustration names are derived from IKeyOfIcons by stripping the "Illus" suffix,
// excluding entries that end with "DarkIllus" (those are auto-selected in dark mode).
// eslint-disable-next-line @typescript-eslint/naming-convention
type StripIllusSuffix<T extends string> = T extends `${infer _Name}DarkIllus`
  ? never
  : T extends `${infer Name}Illus`
    ? Name
    : never;

export type IIllustrationName = StripIllusSuffix<IKeyOfIcons>;

export type IIllustrationProps = {
  name: IIllustrationName;
};

export function Illustration({
  name,
  size = 144,
  ...rest
}: IIllustrationProps & Omit<IIconProps, 'name'>) {
  const themeName = useThemeName();

  const iconName = useMemo(() => {
    if (themeName === 'dark') {
      const darkName = `${name}DarkIllus` as IKeyOfIcons;
      // Only use dark variant if it exists in the icon registry,
      // otherwise fall back to the default variant.
      if (ICON_CONFIG[darkName]) {
        return darkName;
      }
    }
    return `${name}Illus` as IKeyOfIcons;
  }, [name, themeName]);

  return <Icon name={iconName} width={size} height={size} {...rest} />;
}
