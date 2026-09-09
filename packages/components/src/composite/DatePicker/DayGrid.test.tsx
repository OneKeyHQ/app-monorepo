/**
 * @jest-environment jsdom
 */

import type { ComponentProps } from 'react';

import { DatePickerProvider } from '@rehookify/datepicker';
import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { DayGrid } from './DayGrid';

import type { IDayCellProps } from './type';
import type { RenderResult } from '@testing-library/react';

let mockDayCellRenderCount = 0;
let mockCapturedCells: Array<{
  date: string;
  inCurrentMonth: boolean;
  onPress: (date: string) => void;
}> = [];

jest.mock('./DayCell', () => ({
  DayCell: ({ day, onPress }: IDayCellProps) => {
    mockDayCellRenderCount += 1;
    mockCapturedCells.push({
      date: day.date,
      inCurrentMonth: day.inCurrentMonth,
      onPress,
    });
    return null;
  },
}));

// DayGrid only pulls Stack/YStack/SizableText from the primitives barrel;
// replace them with simple pass-through components so the test stays renderer-only.
jest.mock('../../primitives', () => ({
  Stack: ({ children }: { children?: unknown }) => children ?? null,
  YStack: ({ children }: { children?: unknown }) => children ?? null,
  SizableText: ({ children }: { children?: unknown }) => children ?? null,
}));

// Hoisted to module scope rather than inlined in JSX: packages/components
// enforces react_perf/jsx-no-new-object-as-prop, which forbids object
// literals written directly as JSX prop values.
const datePickerConfig: ComponentProps<typeof DatePickerProvider>['config'] = {
  selectedDates: [],
  onDatesChange: () => {},
};

function buildElement() {
  return (
    <DatePickerProvider config={datePickerConfig}>
      <DayGrid calendarIndex={0} hideOutOfMonth={false} />
    </DatePickerProvider>
  );
}

const mockOnDatesChange = jest.fn();

// A second module-scope config (same lint reasoning as above) so the press
// test can supply its own onDatesChange spy without disturbing datePickerConfig.
const datePickerConfigWithHandler: ComponentProps<
  typeof DatePickerProvider
>['config'] = {
  selectedDates: [],
  onDatesChange: mockOnDatesChange,
};

function buildElementWithHandler() {
  return (
    <DatePickerProvider config={datePickerConfigWithHandler}>
      <DayGrid calendarIndex={0} hideOutOfMonth={false} />
    </DatePickerProvider>
  );
}

describe('DayGrid cell memoization', () => {
  beforeEach(() => {
    mockDayCellRenderCount = 0;
    mockCapturedCells = [];
    mockOnDatesChange.mockClear();
  });

  it('does not re-render day cells when the provider re-renders with unchanged data', () => {
    const view: RenderResult = render(buildElement());
    const afterMount = mockDayCellRenderCount;
    expect(afterMount).toBeGreaterThan(0);

    // Re-render with a fresh element; rehookify regenerates all derived
    // objects on every provider render regardless of config identity, so
    // memoized cells must still bail out because the primitive props are
    // unchanged.
    view.rerender(buildElement());
    expect(mockDayCellRenderCount).toBe(afterMount);
  });

  it('resolves the correct day through the ref-stable press handler after a provider re-render', () => {
    const view: RenderResult = render(buildElementWithHandler());
    view.rerender(buildElementWithHandler());

    const targetCell = mockCapturedCells.find((cell) => cell.inCurrentMonth);
    if (!targetCell) {
      throw new OneKeyLocalError(
        'expected an in-current-month cell to have rendered',
      );
    }

    act(() => {
      targetCell.onPress(targetCell.date);
    });

    expect(mockOnDatesChange).toHaveBeenCalledTimes(1);
    const [changedDates] = mockOnDatesChange.mock.calls[0] as [Date[]];
    expect(
      changedDates.some((date) => date.toString() === targetCell.date),
    ).toBe(true);
  });
});
