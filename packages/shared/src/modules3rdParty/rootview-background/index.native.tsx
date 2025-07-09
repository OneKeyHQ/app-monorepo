import { setBackgroundColorAsync } from 'expo-system-ui';

import type { IUpdateRootViewBackgroundColor } from './type';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
) => {
  void setBackgroundColorAsync(color);
};
