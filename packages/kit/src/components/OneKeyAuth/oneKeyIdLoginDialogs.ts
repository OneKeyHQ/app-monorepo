import type { IDialogInstance, IDialogShowProps } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';

const loginDialogs = new Set<IDialogInstance>();

export function showOneKeyIdLoginDialog(props: IDialogShowProps) {
  const instance = Dialog.show({
    ...props,
    onClose: async (extra) => {
      loginDialogs.delete(instance);
      await props.onClose?.(extra);
    },
  });
  loginDialogs.add(instance);
  return instance;
}

export async function closeOneKeyIdLoginDialogs() {
  for (const instance of [...loginDialogs].toReversed()) {
    await instance.close();
    loginDialogs.delete(instance);
  }
}
