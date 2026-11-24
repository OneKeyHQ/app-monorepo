/** @jest-environment jsdom */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { RenameInputWithNameSelector } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
  },
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Stack,
    YStack: Stack,
    ScrollView: Stack,
    SizableText: Stack,
    Form: { FieldDescription: Stack },
    Dialog: {
      show: jest.fn(() => ({ close: jest.fn(async () => undefined) })),
    },
    Button: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Input: ({
      value,
      testID,
      onChangeText,
      addOns,
    }: {
      value?: string;
      testID?: string;
      onChangeText?: (value: string) => void;
      addOns?: { onPress?: () => void }[];
    }) => (
      <div>
        <input
          data-testid={testID}
          value={value}
          onChange={(event) => onChangeText?.(event.target.value)}
        />
        <button
          type="button"
          aria-label="Name history"
          onClick={addOns?.[0]?.onPress}
        >
          Name history
        </button>
      </div>
    ),
  };
});
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { simpleDb: { changeHistory: { getChangeHistory: jest.fn() } } },
}));
jest.mock('../NetworkAvatar', () => ({ NetworkAvatar: () => null }));
jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: (load: () => Promise<unknown>) => {
    const [result, setResult] = useState<unknown>();
    useEffect(() => {
      void load().then(setResult);
      // The input and dialog below each keep one immutable lookup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { result };
  },
}));

it('selecting a retained Wallet name fills the ordinary rename control without submitting', async () => {
  const retained = 'Name kept before the Cloud update';
  const info = {
    entityId: 'hd-example',
    entityType: EChangeHistoryEntityType.Wallet,
    contentType: EChangeHistoryContentType.Name as const,
  };
  const getHistory = jest
    .spyOn(backgroundApiProxy.simpleDb.changeHistory, 'getChangeHistory')
    .mockResolvedValue([{ oldValue: '', value: retained, timestamp: 3000 }]);
  const showDialog = jest.spyOn(Dialog, 'show');
  function Fixture() {
    const [name, setName] = useState('Current server name');
    return (
      <RenameInputWithNameSelector
        inputTestID="wallet-name-input"
        nameHistoryInfo={info}
        value={name}
        onChange={setName}
        disabledMaxLengthLabel
        showSensitiveInfoWarning={false}
      />
    );
  }
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Name history' }));
  const [dialog] = showDialog.mock.calls[0];
  render(<>{dialog.renderContent as ReactNode}</>);
  fireEvent.click(await screen.findByRole('button', { name: retained }));
  expect(screen.getByTestId<HTMLInputElement>('wallet-name-input').value).toBe(
    retained,
  );
  expect(getHistory).toHaveBeenCalledWith(info);
});
