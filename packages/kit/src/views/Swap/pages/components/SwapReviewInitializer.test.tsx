/** @jest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import { ProviderJotaiContextSwap } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';

import { SwapReviewInitializer } from './SwapReviewInitializer';

import type {
  ISwapExecutionSnapshot,
  ISwapReviewState,
} from '../../utils/swapReviewState';

const mockSetSwapReviewExecutionSnapshot = jest.fn();

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap/atoms', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit/src/states/jotai/contexts/swap/atoms')
  >('@onekeyhq/kit/src/states/jotai/contexts/swap/atoms');
  return {
    ...actual,
    useSwapReviewExecutionSnapshotAtom: () => [
      undefined,
      mockSetSwapReviewExecutionSnapshot,
    ],
  };
});

describe('SwapReviewInitializer', () => {
  beforeEach(() => {
    mockSetSwapReviewExecutionSnapshot.mockClear();
  });

  it('installs the frozen execution snapshot and clears it on unmount', async () => {
    const executionSnapshot = {
      reviewRevision: 'review-1',
    } as ISwapExecutionSnapshot;
    const reviewState: ISwapReviewState = {
      steps: [],
      preSwapData: {},
      executionSnapshot,
    };
    const view = render(
      <ProviderJotaiContextSwap store={createStore()}>
        <SwapReviewInitializer reviewState={reviewState} />
      </ProviderJotaiContextSwap>,
    );

    await waitFor(() => {
      expect(mockSetSwapReviewExecutionSnapshot).toHaveBeenCalledWith(
        executionSnapshot,
      );
    });

    view.unmount();
    expect(mockSetSwapReviewExecutionSnapshot).toHaveBeenLastCalledWith(
      undefined,
    );
  });
});
