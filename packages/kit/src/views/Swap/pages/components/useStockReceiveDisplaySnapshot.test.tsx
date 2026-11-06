import { createElement } from 'react';

import { render, renderHook } from '@testing-library/react-native';

import {
  StockReceiveSnapshotProvider,
  useStockReceiveDisplaySnapshot,
} from './useStockReceiveDisplaySnapshot';

import type { IStockReceiveDisplayValue } from './useStockReceiveDisplaySnapshot';

const quoteValue: IStockReceiveDisplayValue = {
  currencySymbol: '$',
  rateDifference: undefined,
  receiveAmount: '10',
  receiveFiatValue: '20',
  receiveTokenSymbol: 'AAPL',
  estimatedShares: '2',
  stockUnderlyingSymbol: 'AAPL',
  shouldShowEstimatedShares: true,
};
const emptyValue = { ...quoteValue, receiveAmount: '', receiveFiatValue: '0' };

describe('useStockReceiveDisplaySnapshot', () => {
  it('invalidates a snapshot when a matching request fails before loading begins', () => {
    const initialProps = {
      scope: 'current',
      canSave: true,
      hideQuote: false,
      isLoading: false,
      invalidate: false,
      value: quoteValue,
    };
    const { result, rerender } = renderHook(useStockReceiveDisplaySnapshot, {
      initialProps,
    });
    rerender({ ...initialProps, canSave: false, value: emptyValue });
    expect(result.current).toEqual(quoteValue);
    rerender({
      ...initialProps,
      canSave: false,
      invalidate: true,
      value: emptyValue,
    });
    expect(result.current).toBeUndefined();
    rerender({
      ...initialProps,
      canSave: false,
      isLoading: true,
      value: emptyValue,
    });
    expect(result.current).toBeUndefined();
  });
  it('retains only a settled matching display while refreshing', () => {
    const initialProps = {
      scope: 'account-a',
      canSave: true,
      hideQuote: false,
      isLoading: false,
      value: quoteValue,
    };
    const { result, rerender } = renderHook(useStockReceiveDisplaySnapshot, {
      initialProps,
    });

    expect(result.current).toBeUndefined();
    rerender({ ...initialProps, isLoading: true, value: emptyValue });
    expect(result.current).toEqual(quoteValue);
    rerender({
      ...initialProps,
      scope: 'account-b',
      isLoading: true,
      value: emptyValue,
    });
    expect(result.current).toBeUndefined();
    rerender({ ...initialProps, isLoading: true, value: emptyValue });
    expect(result.current).toBeUndefined();
  });

  it('does not restore a cached value after a terminal failure or quote error', () => {
    const initialProps = {
      scope: 'current',
      canSave: true,
      hideQuote: false,
      isLoading: false,
      value: quoteValue,
    };
    const { result, rerender } = renderHook(useStockReceiveDisplaySnapshot, {
      initialProps,
    });
    rerender({ ...initialProps, isLoading: true, value: emptyValue });
    expect(result.current).toEqual(quoteValue);
    rerender({
      ...initialProps,
      isLoading: true,
      hideQuote: true,
      value: emptyValue,
    });
    expect(result.current).toBeUndefined();
    rerender({
      ...initialProps,
      isLoading: false,
      canSave: false,
      value: emptyValue,
    });
    rerender({
      ...initialProps,
      isLoading: true,
      canSave: false,
      value: emptyValue,
    });
    expect(result.current).toBeUndefined();
  });

  it('never caches a result whose quote identity is not valid', () => {
    const initialProps = {
      scope: 'current',
      canSave: false,
      hideQuote: false,
      isLoading: false,
      value: quoteValue,
    };
    const { result, rerender } = renderHook(useStockReceiveDisplaySnapshot, {
      initialProps,
    });
    rerender({ ...initialProps, isLoading: true, value: emptyValue });
    expect(result.current).toBeUndefined();
  });

  it('keeps a settled display through a no-quote frame before the next loading starts', () => {
    const initialProps = {
      scope: 'current',
      canSave: true,
      hideQuote: false,
      isLoading: false,
      value: quoteValue,
    };
    const { result, rerender } = renderHook(useStockReceiveDisplaySnapshot, {
      initialProps,
    });
    const empty = { ...initialProps, canSave: false, value: emptyValue };
    rerender(empty);
    expect(result.current).toEqual(quoteValue);
    rerender({ ...empty, isLoading: true });
    expect(result.current).toEqual(quoteValue);
    rerender(empty);
    expect(result.current).toBeUndefined();
    rerender({ ...empty, isLoading: true });
    expect(result.current).toBeUndefined();
  });

  it('preserves the actual displayed quote across an unmount and remount in the same scope', () => {
    const Receive = ({
      scope,
      loading,
      ready = true,
    }: {
      scope?: string;
      loading: boolean;
      ready?: boolean;
    }) => {
      const snapshot = useStockReceiveDisplaySnapshot({
        canSave: ready && !loading,
        hideQuote: false,
        isLoading: loading,
        scope,
        value: loading || !ready ? emptyValue : quoteValue,
      });
      let display = 'settled';
      if (snapshot) {
        display = `${snapshot.receiveAmount} ${snapshot.receiveTokenSymbol} / ${snapshot.currencySymbol}${snapshot.receiveFiatValue}`;
      } else if (loading) {
        display = 'loading';
      }
      return createElement('Text', null, display);
    };
    const Screen = ({
      show,
      scope,
      loading,
      ready,
    }: {
      show: boolean;
      scope?: string;
      loading: boolean;
      ready?: boolean;
    }) => (
      <StockReceiveSnapshotProvider>
        {show ? (
          <Receive scope={scope} loading={loading} ready={ready} />
        ) : null}
      </StockReceiveSnapshotProvider>
    );
    const screen = render(<Screen show scope="account-a" loading={false} />);
    screen.rerender(<Screen show={false} scope="account-a" loading />);
    screen.rerender(<Screen show scope={undefined} loading />);
    expect(screen.toJSON()).toMatchObject({ children: ['loading'] });
    screen.rerender(
      <Screen show scope="account-a" loading={false} ready={false} />,
    );
    expect(screen.toJSON()).toMatchObject({ children: ['10 AAPL / $20'] });
    screen.rerender(<Screen show scope="account-a" loading />);
    expect(screen.toJSON()).toMatchObject({ children: ['10 AAPL / $20'] });
    screen.rerender(<Screen show scope="account-b" loading />);
    expect(screen.toJSON()).toMatchObject({ children: ['loading'] });
    screen.rerender(<Screen show scope="account-a" loading />);
    expect(screen.toJSON()).toMatchObject({ children: ['loading'] });
  });
});
