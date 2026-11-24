/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { SettingsGroup, SettingsSelect } from './TradingViewSettingsPrimitives';

type ISelectProps = {
  defaultTriggerInputProps?: Record<string, unknown>;
};
type IMockTextProps = { children?: ReactNode; testID?: string };

const mockSelect = jest.fn<null, [ISelectProps]>(() => null);
let mockIsNative = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Checkbox: () => null,
  ColorPicker: () => null,
  Divider: () => null,
  Icon: () => null,
  Select: (props: ISelectProps) => mockSelect(props),
  SizableText: ({ children, testID }: IMockTextProps) => (
    <span data-testid={testID}>{children}</span>
  ),
  XStack: ({ children }: IMockTextProps) => children ?? null,
  YStack: ({ children }: IMockTextProps) => children ?? null,
  useMedia: () => ({ md: true }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

const renderSelect = () =>
  render(
    <SettingsSelect
      testID="chart-type"
      title="Chart style"
      value="auto"
      options={['auto', 'line'] as const}
      disabled={false}
      onChange={jest.fn()}
    />,
  );

describe('SettingsSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pins the trigger input flex on native so its width applies', () => {
    mockIsNative = true;
    renderSelect();

    expect(mockSelect.mock.calls[0][0].defaultTriggerInputProps).toEqual(
      expect.objectContaining({ flex: 0, width: 128 }),
    );
  });

  it('keeps the default trigger sizing on web', () => {
    mockIsNative = false;
    renderSelect();

    const triggerProps = mockSelect.mock.calls[0][0].defaultTriggerInputProps;
    expect(triggerProps).toEqual(expect.objectContaining({ width: 128 }));
    expect(triggerProps).not.toHaveProperty('flex');
  });
});

describe('SettingsGroup', () => {
  const descriptionTestID = 'trading-view-settings-group-description';

  it('shows the description below the title', () => {
    render(
      <SettingsGroup title="MA" description="Average closing price.">
        <span>row</span>
      </SettingsGroup>,
    );

    expect(screen.getByText('MA')).toBeTruthy();
    expect(screen.getByTestId(descriptionTestID).textContent).toBe(
      'Average closing price.',
    );
  });

  it('shows a description without a title', () => {
    render(
      <SettingsGroup description="Average closing price.">
        <span>row</span>
      </SettingsGroup>,
    );

    expect(screen.getByTestId(descriptionTestID).textContent).toBe(
      'Average closing price.',
    );
  });

  it('renders no description slot when there is none', () => {
    render(
      <SettingsGroup title="MA">
        <span>row</span>
      </SettingsGroup>,
    );

    expect(screen.queryByTestId(descriptionTestID)).toBeNull();
  });
});
