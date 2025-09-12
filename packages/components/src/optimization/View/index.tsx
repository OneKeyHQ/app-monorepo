import { Stack } from '../../primitives/Stack';

import type { IOptimizationViewType } from './type';
import type { IStackProps } from '../../primitives/Stack';

export function OptimizationView(props: IOptimizationViewType) {
  return <Stack {...(props as IStackProps)} />;
}
