/** @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SettingTestIDs } from '../../../testIDs';

import { ExportDiagnosticLogsListItem } from './ExportDiagnosticLogsListItem';

const mockShowExportLogsDialog = jest.fn((_options: unknown) => undefined);
const mockDismissKeyboard = jest.fn(async () => undefined);
const mockDialogShow = jest.fn((_options: unknown) => undefined);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboardWithDelay: () => mockDismissKeyboard(),
}));

jest.mock('./showExportLogsDialog', () => ({
  showExportLogsDialog: (options: unknown) => {
    mockShowExportLogsDialog(options);
  },
}));

jest.mock('../ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TabSettingsListItem: ({
      title,
      subtitle,
      onPress,
      testID,
    }: {
      title?: string;
      subtitle?: React.ReactNode;
      onPress?: () => void | Promise<void>;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        {
          role: 'button',
          onClick: () => {
            void onPress?.();
          },
          'data-testid': testID,
        },
        title,
        subtitle,
      ),
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Dialog: {
      show: (options: unknown) => {
        mockDialogShow(options);
      },
    },
    SizableText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    Stack: ({
      children,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      onPress?: (event: { stopPropagation: () => void }) => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: (event: { stopPropagation: () => void }) => {
            onPress?.(event);
          },
          'data-testid': testID,
        },
        children,
      ),
    YStack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ExportDiagnosticLogsListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the upload dialog from the row', async () => {
    const logItemClick = jest.fn();
    const view = render(
      <ExportDiagnosticLogsListItem
        title="Export diagnostic logs"
        logItemClick={logItemClick}
      />,
    );

    expect(
      view.getByText(ETranslations.settings_export_diagnostic_logs__desc),
    ).toBeTruthy();
    expect(
      view.getByText(ETranslations.settings_diagnostic_logs_contents__title),
    ).toBeTruthy();

    fireEvent.click(view.getByTestId(SettingTestIDs.exportDiagnosticLogsItem));
    await Promise.resolve();

    expect(logItemClick).toHaveBeenCalledTimes(1);
    expect(mockShowExportLogsDialog).toHaveBeenCalledWith({
      title: ETranslations.settings_upload_state_logs,
    });
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('opens only the contents dialog from the nested learn-more link', async () => {
    const logItemClick = jest.fn();
    const view = render(
      <ExportDiagnosticLogsListItem
        title="Export diagnostic logs"
        logItemClick={logItemClick}
      />,
    );

    fireEvent.click(
      view.getByTestId(SettingTestIDs.exportDiagnosticLogsHelpLink),
    );
    await Promise.resolve();

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockShowExportLogsDialog).not.toHaveBeenCalled();
    expect(logItemClick).not.toHaveBeenCalled();
  });
});
