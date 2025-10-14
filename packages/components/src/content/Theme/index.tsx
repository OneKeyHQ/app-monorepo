import { Theme as TamaguiTheme } from '../../shared/tamagui';

import type { ThemeProps } from '../../shared/tamagui';

export function Theme(props: ThemeProps) {
  return <TamaguiTheme {...props} />;
}
