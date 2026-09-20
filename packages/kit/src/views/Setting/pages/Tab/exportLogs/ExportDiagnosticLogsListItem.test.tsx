/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SettingTestIDs } from '../../../testIDs';

import { ExportDiagnosticLogsListItem } from './ExportDiagnosticLogsListItem';
import { showDiagnosticLogsContentsDialog } from './showDiagnosticLogsContentsDialog';
import type { IntlShape } from 'react-intl';

const mockShowExportLogsDialog = jest.fn((_options: unknown) => undefined);
const mockDismissKeyboard = jest.fn(async () => undefined);
const mockDialogShow = jest.fn((_options: unknown) => undefined);
const mockIntl = {
  formatMessage: ({ id }: { id: string }) => id,
} as IntlShape;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboardWithDelay: (...args: unknown[]) =>
    mockDismissKeyboard(...args),
}));

jest.mock('./showExportLogsDialog', () => ({
  showExportLogsDialog: (...args: unknown[]) => {
    mockShowExportLogsDialog(...args);
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
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              void onPress?.();
            },
            'data-testid': testID,
          },
          title,
        ),
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
      onPress?: (event?: { stopPropagation: () => void }) => void;
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
    XStack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    YStack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ExportDiagnosticLogsListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the upload dialog from the row and the contents dialog from the link', async () => {
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
      view.getByText(ETranslations.settings_export_diagnostic_logs__learn_more),
    ).toBeTruthy();

    fireEvent.click(view.getByTestId(SettingTestIDs.exportDiagnosticLogsItem));
    await Promise.resolve();

    expect(logItemClick).toHaveBeenCalledTimes(1);
    expect(mockShowExportLogsDialog).toHaveBeenCalledWith({
      title: ETranslations.settings_upload_state_logs,
    });
    expect(mockDialogShow).not.toHaveBeenCalled();

    fireEvent.click(
      view.getByTestId(SettingTestIDs.exportDiagnosticLogsHelpLink),
    );
    expect(logItemClick).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockShowExportLogsDialog).toHaveBeenCalledTimes(1);
  });
});

describe('showDiagnosticLogsContentsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an info dialog without a cancel button', () => {
    showDiagnosticLogsContentsDialog(mockIntl);

    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'InfoCircleOutline',
        title: ETranslations.settings_export_diagnostic_logs__learn_more,
        showCancelButton: false,
        onConfirmText: ETranslations.global_i_got_it,
      }),
    );

    const dialogOptions = mockDialogShow.mock.calls[0][0] as {
      renderContent: ReactElement;
    };
    const content = render(dialogOptions.renderContent);
    expect(
      content.getByText(
        ETranslations.settings_export_diagnostic_logs__included,
      ),
    ).toBeTruthy();
    expect(
      content.getByText(
        ETranslations.settings_export_diagnostic_logs__not_included,
      ),
    ).toBeTruthy();
    expect(
      content.getByText(
        ETranslations.settings_export_diagnostic_logs__item_local_data,
      ),
    ).toBeTruthy();
    expect(
      content.getByText(
        ETranslations.settings_export_diagnostic_logs__item_private_keys,
      ),
    ).toBeTruthy();
  });
});
