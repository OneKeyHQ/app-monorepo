/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PerpSettingsButton } from './PerpSettingsButton';

const mockShowPerpSettingsDialog = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
  IconButton: ({ onPress }: { onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      settings
    </button>
  ),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useMedia: () => ({ gtXl: false }),
}));

jest.mock('../hooks/useShowGuide', () => ({
  useShowGuide: () => ({ showGuide: jest.fn() }),
}));

jest.mock('./PerpsActivityCenterAction', () => ({
  PerpsActivityCenterAction: () => null,
}));

jest.mock('./PerpSettingsDialog', () => ({
  PerpSettingsPopover: () => null,
  showPerpSettingsDialog: (options: unknown) => {
    mockShowPerpSettingsDialog(options);
  },
}));

describe('PerpSettingsButton', () => {
  beforeEach(() => {
    mockShowPerpSettingsDialog.mockReset();
  });

  it('always shows layout settings in the mobile menu', () => {
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
  });
});
