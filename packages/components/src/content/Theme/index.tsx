import { Theme as TamaguiTheme } from 'tamagui';

import type { ThemeProps } from 'tamagui';

export function Theme(props: ThemeProps) {
  return <TamaguiTheme {...props} />;
}
