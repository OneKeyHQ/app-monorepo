import { toast } from 'sonner';

import type { IToastMessageOptions } from './type';

export function showMessage({
  renderContent,
  ...options
}: IToastMessageOptions) {
  const toastId = toast(renderContent(), {
    ...options,
  });
  return {
    close: () => {
      toast.dismiss(toastId);
    },
  };
}
