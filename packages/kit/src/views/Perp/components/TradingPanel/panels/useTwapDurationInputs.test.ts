/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  splitTwapDurationMinutes,
  useTwapDurationInputs,
} from './useTwapDurationInputs';

function renderInputs(durationMinutes: string, orderKey = 'perp:BTC') {
  return renderHook(
    (props: { durationMinutes: string; orderKey: string }) =>
      useTwapDurationInputs({ ...props, isTwapMode: true }),
    { initialProps: { durationMinutes, orderKey } },
  );
}

it('splits a duration into hours and minutes', () => {
  expect(splitTwapDurationMinutes(135)).toEqual({ hours: 2, minutes: 15 });
});

it('shows the duration of the order', () => {
  const inputs = renderInputs('60');
  expect(inputs.result.current).toMatchObject({
    hoursInput: '1',
    minutesInput: '0',
  });

  inputs.rerender({ durationMinutes: '135', orderKey: 'perp:BTC' });
  expect(inputs.result.current).toMatchObject({
    hoursInput: '2',
    minutesInput: '15',
  });
});

it('leaves a duration being typed alone', () => {
  const inputs = renderInputs('60');
  // The minutes field has the focus, and 1 is typed on the way to 10.
  act(() => {
    inputs.result.current.focusedFieldRef.current = 'minutes';
    inputs.result.current.setHoursInput('');
    inputs.result.current.setMinutesInput('1');
  });

  inputs.rerender({ durationMinutes: '1', orderKey: 'perp:BTC' });

  expect(inputs.result.current).toMatchObject({
    hoursInput: '',
    minutesInput: '1',
  });
});

it('shows the duration of the order the page goes back to though a field has the focus', () => {
  // A 60 minute TWAP on BTC; ETH shows, and 10 minutes are typed for it.
  const inputs = renderInputs('60');
  inputs.rerender({ durationMinutes: '60', orderKey: 'perp:ETH' });
  act(() => {
    inputs.result.current.focusedFieldRef.current = 'minutes';
    inputs.result.current.setHoursInput('');
    inputs.result.current.setMinutesInput('10');
  });
  inputs.rerender({ durationMinutes: '10', orderKey: 'perp:ETH' });
  expect(inputs.result.current).toMatchObject({
    hoursInput: '',
    minutesInput: '10',
  });

  // The switch fails: the page is back on BTC with the order it had there,
  // and the field still has the focus.
  inputs.rerender({ durationMinutes: '60', orderKey: 'perp:BTC' });

  // Not 10 minutes, which the order no longer is.
  expect(inputs.result.current).toMatchObject({
    hoursInput: '1',
    minutesInput: '0',
  });
});
