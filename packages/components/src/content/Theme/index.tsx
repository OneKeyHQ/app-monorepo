import { Theme as TamaguiTheme } from '@tamagui/web';

import type { ThemeProps } from '@tamagui/web';

export function Theme(props: ThemeProps) {
  return <TamaguiTheme {...props} />;
}
