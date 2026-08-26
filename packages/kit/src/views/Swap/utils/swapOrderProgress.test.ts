import {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapOrderProgressSteps } from './swapOrderProgress';

describe('getSwapOrderProgressSteps', () => {
  it.each([
    ESwapTxHistoryStatus.PENDING,
    ESwapTxHistoryStatus.DEPOSIT_SUCCESS,
    ESwapTxHistoryStatus.CANCELING,
  ])('renders the three-step pending state for %s', (status) => {
    expect(getSwapOrderProgressSteps({ status })).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'pending', status: 'process' },
      { label: 'done', status: 'todo' },
    ]);
  });

  it.each([
    ESwapTxHistoryStatus.SUCCESS,
    ESwapTxHistoryStatus.PARTIALLY_FILLED,
  ])('renders the three-step success state for %s', (status) => {
    expect(getSwapOrderProgressSteps({ status })).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'pending', status: 'done' },
      { label: 'done', status: 'done' },
    ]);
  });

  it.each([ESwapTxHistoryStatus.FAILED, ESwapTxHistoryStatus.CANCELED])(
    'renders the three-step failed state for %s',
    (status) => {
      expect(getSwapOrderProgressSteps({ status })).toEqual([
        { label: 'submitted', status: 'done' },
        { label: 'failed', status: 'error' },
        { label: 'done', status: 'todo' },
      ]);
    },
  );

  it.each([
    ESwapCrossChainStatus.FROM_SUCCESS,
    ESwapCrossChainStatus.BRIDGE_PENDING,
    ESwapCrossChainStatus.BRIDGE_SUCCESS,
    ESwapCrossChainStatus.TO_PENDING,
  ])('merges %s into the To chain processing step', (crossChainStatus) => {
    expect(
      getSwapOrderProgressSteps({
        status: ESwapTxHistoryStatus.PENDING,
        crossChainStatus,
      }),
    ).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'fromChain', status: 'done' },
      { label: 'toChain', status: 'process' },
      { label: 'done', status: 'todo' },
    ]);
  });

  it.each([
    {
      crossChainStatus: ESwapCrossChainStatus.FROM_PENDING,
      expected: [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'process' },
        { label: 'toChain', status: 'todo' },
        { label: 'done', status: 'todo' },
      ],
    },
    {
      crossChainStatus: ESwapCrossChainStatus.FROM_FAILED,
      expected: [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'error' },
        { label: 'toChain', status: 'todo' },
        { label: 'done', status: 'todo' },
      ],
    },
    {
      crossChainStatus: ESwapCrossChainStatus.BRIDGE_FAILED,
      expected: [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'done' },
        { label: 'toChain', status: 'error' },
        { label: 'done', status: 'todo' },
      ],
    },
    {
      crossChainStatus: ESwapCrossChainStatus.TO_FAILED,
      expected: [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'done' },
        { label: 'toChain', status: 'error' },
        { label: 'done', status: 'todo' },
      ],
    },
  ])(
    'maps $crossChainStatus to its failed stage',
    ({ crossChainStatus, expected }) => {
      expect(
        getSwapOrderProgressSteps({
          status: ESwapTxHistoryStatus.PENDING,
          crossChainStatus,
        }),
      ).toEqual(expected);
    },
  );

  it.each([
    ESwapCrossChainStatus.TO_SUCCESS,
    ESwapCrossChainStatus.FROM_PENDING,
  ])('supports a direct jump to success from %s', (crossChainStatus) => {
    expect(
      getSwapOrderProgressSteps({
        status: ESwapTxHistoryStatus.SUCCESS,
        crossChainStatus,
      }),
    ).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'fromChain', status: 'done' },
      { label: 'toChain', status: 'done' },
      { label: 'done', status: 'done' },
    ]);
  });

  it.each([
    ESwapCrossChainStatus.FROM_PENDING,
    ESwapCrossChainStatus.FROM_SUCCESS,
    ESwapCrossChainStatus.BRIDGE_PENDING,
    ESwapCrossChainStatus.BRIDGE_SUCCESS,
    ESwapCrossChainStatus.TO_PENDING,
  ])(
    'prioritizes a top-level failed status over stale %s',
    (crossChainStatus) => {
      for (const status of [
        ESwapTxHistoryStatus.FAILED,
        ESwapTxHistoryStatus.CANCELED,
      ]) {
        expect(getSwapOrderProgressSteps({ status, crossChainStatus })).toEqual(
          [
            { label: 'submitted', status: 'done' },
            { label: 'failed', status: 'error' },
            { label: 'done', status: 'todo' },
          ],
        );
      }
    },
  );

  it('renders REFUNDING as an active Refund step', () => {
    expect(
      getSwapOrderProgressSteps({
        status: ESwapTxHistoryStatus.PENDING,
        crossChainStatus: ESwapCrossChainStatus.REFUNDING,
      }),
    ).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'fromChain', status: 'done' },
      { label: 'toChain', status: 'error' },
      { label: 'refund', status: 'process' },
    ]);
  });

  it('renders REFUNDED as a completed Refund step', () => {
    expect(
      getSwapOrderProgressSteps({
        status: ESwapTxHistoryStatus.PENDING,
        crossChainStatus: ESwapCrossChainStatus.REFUNDED,
      }),
    ).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'fromChain', status: 'done' },
      { label: 'toChain', status: 'error' },
      { label: 'refund', status: 'done' },
    ]);
  });

  it('renders a failed Refund step', () => {
    expect(
      getSwapOrderProgressSteps({
        status: ESwapTxHistoryStatus.FAILED,
        crossChainStatus: ESwapCrossChainStatus.REFUND_FAILED,
      }),
    ).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'fromChain', status: 'done' },
      { label: 'toChain', status: 'error' },
      { label: 'refund', status: 'error' },
    ]);
  });

  it.each([
    ESwapCrossChainStatus.EXPIRED,
    ESwapCrossChainStatus.PROVIDER_ERROR,
  ])('degrades %s to the three-step failed state', (crossChainStatus) => {
    expect(
      getSwapOrderProgressSteps({
        status: ESwapTxHistoryStatus.PENDING,
        crossChainStatus,
      }),
    ).toEqual([
      { label: 'submitted', status: 'done' },
      { label: 'failed', status: 'error' },
      { label: 'done', status: 'todo' },
    ]);
  });
});
