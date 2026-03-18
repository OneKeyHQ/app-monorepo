import { toast } from 'sonner';

import type { IToastMessageOptions } from './type';

export function showMessage({
  renderContent,
  toastId: stableId,
  ...options
}: IToastMessageOptions) {
  const toastId = toast(renderContent(), {
    ...options,
    ...(stableId ? { id: stableId } : {}),
  });
  return {
    close: () => {
      toast.dismiss(toastId);
    },
  };
}

export function dismissToast(id: string | number) {
  toast.dismiss(id);
}
