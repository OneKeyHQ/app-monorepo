/** @jest-environment jsdom */
import { type PropsWithChildren, type ReactNode, isValidElement } from 'react';

import { act, render, screen } from '@testing-library/react';
import { createStore } from 'jotai';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  tokenApproveInfoAtom,
  unsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { showApproveEditor } from './ApproveEditor';

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn(), Footer: () => null },
  Form: Object.assign(({ children }: PropsWithChildren) => children, {
    Field: ({
      children,
      labelAddon,
    }: PropsWithChildren<{ labelAddon?: ReactNode }>) => (
      <>
        {labelAddon}
        {children}
      </>
    ),
  }),
  Input: ({ editable }: { editable: boolean }) => (
    <input readOnly={!editable} />
  ),
  Switch: ({ disabled }: { disabled: boolean }) => (
    <input type="checkbox" disabled={disabled} />
  ),
  Button: ({ disabled }: { disabled: boolean }) => (
    <button type="button" disabled={disabled}>
      Balance
    </button>
  ),
  NumberSizeableText: () => null,
  useForm:
    jest.requireActual<typeof import('react-hook-form')>('react-hook-form')
      .useForm,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: { tokenBalanceParsed: '100' } }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useTokenApproveAllowance', () => ({
  useTokenApproveAllowance: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceSend: { updateUnsignedTx: jest.fn() } },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: () => 'Edit allowance' } },
}));

const first = { encodedTx: 'original' };
const reduced = { encodedTx: 'reduced' };
const edit = { allowance: '2', isUnlimited: false };
const service = jest.mocked(backgroundApiProxy.serviceSend);

function openEditor() {
  const store = createStore();
  store.set(unsignedTxsAtom(), [first]);
  store.set(tokenApproveInfoAtom(), {
    originalAllowance: '1',
    originalIsUnlimited: false,
  });
  showApproveEditor(store, {
    accountId: 'test',
    networkId: 'evm--1',
    tokenAddress: '',
    tokenDecimals: 18,
    tokenSymbol: 'TEST',
    allowance: '100',
    isUnlimited: true,
  });
  const dialog = jest.mocked(Dialog.show).mock.lastCall![0];
  const editor = dialog.renderContent;
  if (
    !isValidElement<{ onSave: (value: typeof edit) => Promise<void> }>(editor)
  ) {
    throw new OneKeyLocalError('Missing allowance editor');
  }
  return { store, dialog, editor, save: () => editor.props.onSave(edit) };
}

it('blocks dismissal and reset until the saved transaction is installed', async () => {
  const pending = Promise.withResolvers<typeof reduced>();
  service.updateUnsignedTx.mockReturnValueOnce(pending.promise);
  const { store, dialog, save } = openEditor();
  const saving = save();
  expect(dialog.onBeforeClose?.()).toBe(false);
  const close = jest.fn();
  await Promise.resolve(dialog.onCancel?.(close));
  expect(close).not.toHaveBeenCalled();
  expect(store.get(unsignedTxsAtom())).toEqual([first]);
  pending.resolve(reduced);
  await saving;
  expect(store.get(unsignedTxsAtom())).toEqual([reduced]);
  expect(dialog.onBeforeClose?.()).toBe(true);
});

it('waits for reset and discards an edit after the queue advances', async () => {
  const pending = Promise.withResolvers<typeof reduced>();
  service.updateUnsignedTx.mockReturnValueOnce(pending.promise);
  const { store, dialog } = openEditor();
  const close = jest.fn();
  const resetting = Promise.resolve(dialog.onCancel?.(close));
  expect(dialog.onBeforeClose?.()).toBe(false);
  expect(close).not.toHaveBeenCalled();
  const next = { encodedTx: 'next item' };
  store.set(unsignedTxsAtom(), [next]);
  pending.resolve(reduced);
  await resetting;
  expect(store.get(unsignedTxsAtom())).toEqual([next]);
  expect(close).toHaveBeenCalledTimes(1);
});

it('keeps the original transaction and allows retry when saving fails', async () => {
  service.updateUnsignedTx
    .mockRejectedValueOnce(new Error('rewrite failed'))
    .mockResolvedValueOnce(reduced);
  const { store, dialog, save } = openEditor();
  await expect(save()).rejects.toThrow('rewrite failed');
  expect(store.get(unsignedTxsAtom())).toEqual([first]);
  expect(dialog.onBeforeClose?.()).toBe(true);
  await save();
  expect(store.get(unsignedTxsAtom())).toEqual([reduced]);
});

it.each(['save', 'reset'] as const)(
  'locks all allowance inputs during %s and unlocks them on failure',
  async (action) => {
    const { editor, dialog, save } = openEditor();
    const pending = Promise.withResolvers<typeof reduced>();
    service.updateUnsignedTx.mockReturnValueOnce(pending.promise);
    render(editor);
    const amount = screen.getByRole<HTMLInputElement>('textbox');
    const unlimited = screen.getByRole<HTMLInputElement>('checkbox');
    const balance = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Balance',
    });
    const locked = () => [
      amount.readOnly,
      unlimited.disabled,
      balance.disabled,
    ];
    expect(locked()).toEqual([false, false, false]);
    let operation: Promise<void> | undefined;
    act(() => {
      operation =
        action === 'save'
          ? save()
          : Promise.resolve(dialog.onCancel?.(jest.fn()));
    });
    expect(locked()).toEqual([true, true, true]);
    await act(async () => {
      pending.reject(new Error('rewrite failed'));
      await expect(operation).rejects.toThrow('rewrite failed');
    });
    expect(locked()).toEqual([false, false, false]);
  },
);
