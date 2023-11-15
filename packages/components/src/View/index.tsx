import { Stack } from '../Stack';

import type { IViewType } from './type';

export function View(props: IViewType) {
  return <Stack {...props} />;
}
