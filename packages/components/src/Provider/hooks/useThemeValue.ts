import { useToken } from 'native-base';

import type { ThemeToken } from '../theme';

const useThemeValue = <T extends ThemeToken[] | ThemeToken>(
  colorSymbol: T,
  fallback?: T,
): T extends Array<string> ? string[] : string =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useToken<any>('colors', colorSymbol, fallback);
export default useThemeValue;
