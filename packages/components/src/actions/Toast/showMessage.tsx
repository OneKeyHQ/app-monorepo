import { toast } from 'sonner';

import type { IToastMessageOptions } from './type';

export function showMessage({
  renderContent,
  ...options
}: IToastMessageOptions) {
  toast(renderContent(), {
    ...options,
  });
}
