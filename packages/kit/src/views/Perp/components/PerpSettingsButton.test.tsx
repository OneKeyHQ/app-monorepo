/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PerpSettingsButton } from './PerpSettingsButton';

const mockShowPerpSettingsDialog = jest.fn();
let mockMedia = { gtMd: false, gtXl: false };

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
  useMedia: () => mockMedia,
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
    mockMedia = { gtMd: false, gtXl: false };
  });

  it('always shows layout settings in the mobile menu', () => {
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
  });

  it('hides layout settings in the medium desktop menu', () => {
    mockMedia = { gtMd: true, gtXl: false };
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: false }),
    );
  });

  it('keeps an explicitly requested layout setting visible', () => {
    mockMedia = { gtMd: true, gtXl: false };
    const view = render(<PerpSettingsButton showChartPositionSetting />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
  });
});
