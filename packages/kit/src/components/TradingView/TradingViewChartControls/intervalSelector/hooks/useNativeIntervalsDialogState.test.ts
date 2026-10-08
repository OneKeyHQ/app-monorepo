/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNativeIntervalsDialogState } from './useNativeIntervalsDialogState';

const mockFormatMessage = jest.fn(
  (
    { id }: { id: string },
    values?: {
      number?: number;
    },
  ) => `${id}${values?.number === undefined ? '' : `:${values.number}`}`,
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: mockFormatMessage,
  }),
}));

const options = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
];

function renderDialogState(maxPreferredIntervalCount: number | null) {
  return renderHook(() =>
    useNativeIntervalsDialogState({
      options,
      editableOptions: options,
      activeInterval: '1',
      preferredValues: options
        .slice(0, maxPreferredIntervalCount ?? undefined)
        .map((option) => option.value),
      defaultPreferredValues: ['1', '5', '15', '30'],
      onIntervalChange: jest.fn(),
      onPreferredValuesChange: jest.fn(),
      onClose: jest.fn(),
      maxPreferredIntervalCount,
    }),
  );
}

describe('useNativeIntervalsDialogState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the translated four-slot selection counter', () => {
    const { result } = renderDialogState(4);

    expect(result.current.editTitle).toBe(
      `${ETranslations.market_select_preferred_intervals}:4`,
    );
  });

  it('avoids the hard-coded four-slot counter for compact layouts', () => {
    const { result } = renderDialogState(6);

    expect(result.current.editTitle).toBe(
      ETranslations.market_edit_preferred_intervals,
    );
  });
});
