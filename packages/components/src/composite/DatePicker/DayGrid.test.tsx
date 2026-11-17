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
  range?: IDayCellProps['day']['range'];
  onPress: (date: string) => void;
  onHoverIn?: (date: string) => void;
}> = [];

jest.mock('./DayCell', () => ({
  DayCell: ({ day, onPress, onHoverIn }: IDayCellProps) => {
    mockDayCellRenderCount += 1;
    mockCapturedCells.push({
      date: day.date,
      inCurrentMonth: day.inCurrentMonth,
      range: day.range,
      onPress,
      onHoverIn,
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

// Range anchor picked, second date pending: hovering back onto the anchor
// must not draw a half band (rehookify labels only the anchor, as a start).
const RANGE_ANCHOR = new Date(2026, 6, 15);
const rangeAnchorConfig: ComponentProps<typeof DatePickerProvider>['config'] = {
  selectedDates: [RANGE_ANCHOR],
  onDatesChange: () => {},
  dates: { mode: 'range' },
};

function buildRangeElement() {
  return (
    <DatePickerProvider config={rangeAnchorConfig}>
      <DayGrid calendarIndex={0} hideOutOfMonth={false} />
    </DatePickerProvider>
  );
}

function latestCell(date: Date) {
  const cell = mockCapturedCells.findLast(
    (item) => item.date === date.toString(),
  );
  if (!cell) {
    throw new OneKeyLocalError(`expected a cell for ${date.toDateString()}`);
  }
  return cell;
}

describe('DayGrid range hover preview', () => {
  beforeEach(() => {
    mockCapturedCells = [];
  });

  it('renders a hovered anchor as a one-day range', () => {
    render(buildRangeElement());
    act(() => {
      latestCell(RANGE_ANCHOR).onHoverIn?.(RANGE_ANCHOR.toString());
    });
    expect(latestCell(RANGE_ANCHOR).range).toBe('range-start range-end');
  });

  it('keeps the anchor as the preview start when a later day is hovered', () => {
    render(buildRangeElement());
    const hovered = new Date(2026, 6, 20);
    act(() => {
      latestCell(hovered).onHoverIn?.(hovered.toString());
    });
    expect(latestCell(RANGE_ANCHOR).range).toBe('will-be-range-start');
    expect(latestCell(hovered).range).toBe('will-be-range-end');
  });
});
