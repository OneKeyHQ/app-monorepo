/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PerpSettingsButton } from './PerpSettingsButton';

const mockShowPerpSettingsDialog = jest.fn();
const mockPerpSettingsPopover = jest.fn();
const mockSettingsTourVisited = jest.fn();
let mockMedia = { gtMd: false, gtXl: false };
let mockSettingsIsFirstVisit = true;

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
  Stack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  useMedia: () => mockMedia,
}));

jest.mock('@onekeyhq/kit/src/components/Spotlight', () => ({
  useSpotlight: () => ({
    isFirstVisit: mockSettingsIsFirstVisit,
    tourTimes: mockSettingsIsFirstVisit ? 0 : 1,
    tourVisited: mockSettingsTourVisited,
  }),
}));

jest.mock('../hooks/useShowGuide', () => ({
  useShowGuide: () => ({ showGuide: jest.fn() }),
}));

jest.mock('./PerpsActivityCenterAction', () => ({
  PerpsActivityCenterAction: () => null,
}));

jest.mock('./PerpSettingsDialog', () => ({
  PerpSettingsPopover: (props: { renderTrigger: ReactNode }) => {
    mockPerpSettingsPopover(props);
    return props.renderTrigger;
  },
  showPerpSettingsDialog: (options: unknown) => {
    mockShowPerpSettingsDialog(options);
  },
}));

describe('PerpSettingsButton', () => {
  beforeEach(() => {
    mockShowPerpSettingsDialog.mockReset();
    mockPerpSettingsPopover.mockReset();
    mockSettingsTourVisited.mockReset();
    mockSettingsIsFirstVisit = true;
    mockMedia = { gtMd: false, gtXl: false };
  });

  it('always shows layout settings in the mobile menu', () => {
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
    expect(mockSettingsTourVisited).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('perp-mobile-settings-feature-dot')).toBeTruthy();
  });

  it('hides the mobile feature dot after the menu feature is visited', () => {
    mockSettingsIsFirstVisit = false;
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(view.queryByTestId('perp-mobile-settings-feature-dot')).toBeNull();
    expect(mockSettingsTourVisited).not.toHaveBeenCalled();
  });

  it('uses a popover and hides layout settings in the medium desktop menu', () => {
    mockMedia = { gtMd: true, gtXl: false };
    const view = render(<PerpSettingsButton />);

    expect(mockPerpSettingsPopover).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: false }),
    );
    expect(mockShowPerpSettingsDialog).not.toHaveBeenCalled();
    expect(view.queryByTestId('perp-mobile-settings-feature-dot')).toBeNull();
    expect(mockSettingsTourVisited).not.toHaveBeenCalled();
  });

  it('keeps an explicitly requested layout setting visible', () => {
    mockMedia = { gtMd: true, gtXl: false };
    render(<PerpSettingsButton showChartPositionSetting />);

    expect(mockPerpSettingsPopover).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
    expect(mockShowPerpSettingsDialog).not.toHaveBeenCalled();
  });
});
