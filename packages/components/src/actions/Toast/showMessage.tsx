import { toast } from 'sonner';

import type { IToastMessageOptions } from './type';

export function showMessage({
  title,
  duration,
  ...options
}: IToastMessageOptions) {
  toast(title, {
    duration: duration * 1000,
    ...options,
  });
}
