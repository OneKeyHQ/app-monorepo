import type { IDialogInstance } from '@onekeyhq/components';

type ICreateBootloaderModeDialog = (params: {
  onClose: () => void;
  onUpdate: () => Promise<void>;
}) => IDialogInstance;

export class BootloaderModeDialogManager {
  private activeDialog: IDialogInstance | undefined;

  private updateAction: (() => Promise<void>) | undefined;

  show({
    createDialog,
    onUpdate,
  }: {
    createDialog: ICreateBootloaderModeDialog;
    onUpdate: () => Promise<void>;
  }) {
    this.updateAction = onUpdate;
    if (this.activeDialog) {
      return this.activeDialog;
    }

    const dialog = createDialog({
      onClose: () => {
        if (this.activeDialog === dialog) {
          this.activeDialog = undefined;
          this.updateAction = undefined;
        }
      },
      onUpdate: async () => {
        await this.updateAction?.();
      },
    });
    this.activeDialog = dialog;
    return dialog;
  }

  async close() {
    const dialog = this.activeDialog;
    if (!dialog) {
      return;
    }

    await dialog.close();
  }
}

export const bootloaderModeDialogManager = new BootloaderModeDialogManager();
