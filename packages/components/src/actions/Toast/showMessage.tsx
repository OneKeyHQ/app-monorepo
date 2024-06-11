import { toast } from 'sonner';

import type { IToastMessageOptions } from './type';

export function showMessage({ title, ...options }: IToastMessageOptions) {
  toast(title, {
    ...options,
  });
}
