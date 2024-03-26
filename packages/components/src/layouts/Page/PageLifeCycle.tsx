import { usePageLifeCycle } from './hooks';

import type { IPageLifeCycle } from './type';

export function PageLifeCycle({ onMounted, onUnmounted }: IPageLifeCycle) {
  usePageLifeCycle({ onMounted, onUnmounted });
  return null;
}
