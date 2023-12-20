import { Dialog } from '@onekeyhq/components';

import { RemoveWalletDialog } from './RemoveWalletDialog';

export const useRemoveWallet = ({
  checked,
  title,
  description,
}: {
  checked: boolean;
  title: string;
  description: string;
}) =>
  new Promise<boolean>((resolve) => {
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title,
      description,
      renderContent: (
        <RemoveWalletDialog
          defaultValue={checked}
          onChange={(value: boolean) => {
            resolve(value);
          }}
        />
      ),
    });
  });
export const useWalletActions = () => ({
  remove: useRemoveWallet,
});
