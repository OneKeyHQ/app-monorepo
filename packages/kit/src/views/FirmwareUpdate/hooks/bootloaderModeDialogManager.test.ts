import type { IDialogInstance } from '@onekeyhq/components';

import { BootloaderModeDialogManager } from './bootloaderModeDialogManager';

function createDialogMock() {
  let onClose: (() => void) | undefined;
  let onUpdate: (() => Promise<void>) | undefined;
  const dialog: IDialogInstance = {
    close: jest.fn(async () => {
      onClose?.();
    }),
    getForm: jest.fn(() => undefined),
    isExist: jest.fn(() => true),
  };
  const createDialog = jest.fn((params) => {
    onClose = params.onClose;
    onUpdate = params.onUpdate;
    return dialog;
  });

  return {
    createDialog,
    dialog,
    runUpdate: async () => onUpdate?.(),
  };
}

describe('BootloaderModeDialogManager', () => {
  it('reuses the active dialog across independent callers', async () => {
    const manager = new BootloaderModeDialogManager();
    const first = createDialogMock();
    const second = createDialogMock();
    const firstUpdate = jest.fn(async () => undefined);
    const secondUpdate = jest.fn(async () => undefined);

    expect(
      manager.show({
        createDialog: first.createDialog,
        onUpdate: firstUpdate,
      }),
    ).toBe(first.dialog);
    expect(
      manager.show({
        createDialog: second.createDialog,
        onUpdate: secondUpdate,
      }),
    ).toBe(first.dialog);
    expect(first.createDialog).toHaveBeenCalledTimes(1);
    expect(second.createDialog).not.toHaveBeenCalled();

    await first.runUpdate();
    expect(firstUpdate).not.toHaveBeenCalled();
    expect(secondUpdate).toHaveBeenCalledTimes(1);
  });

  it('allows a new dialog after the active one closes', async () => {
    const manager = new BootloaderModeDialogManager();
    const first = createDialogMock();
    const second = createDialogMock();
    const onUpdate = jest.fn(async () => undefined);

    manager.show({ createDialog: first.createDialog, onUpdate });
    await manager.close();

    expect(first.dialog.close).toHaveBeenCalledTimes(1);
    expect(manager.show({ createDialog: second.createDialog, onUpdate })).toBe(
      second.dialog,
    );
    expect(second.createDialog).toHaveBeenCalledTimes(1);
  });
});
