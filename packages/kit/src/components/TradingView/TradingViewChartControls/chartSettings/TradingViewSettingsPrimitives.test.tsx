/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { SettingsSelect } from './TradingViewSettingsPrimitives';

type ISelectProps = {
  defaultTriggerInputProps?: Record<string, unknown>;
};

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
  SizableText: () => null,
  XStack: () => null,
  YStack: () => null,
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
