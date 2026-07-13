import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import { SizableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';

import { formatRelativeTimeAbbrAt } from '../hooks/transactionRelativeTimeUtils';

const TransactionsRelativeTimeContext = createContext<number>(Date.now());

export function TransactionsRelativeTimeProvider({
  children,
  isTickingEnabled,
}: PropsWithChildren<{ isTickingEnabled: boolean }>) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (isTickingEnabled) {
      setNowMs(Date.now());
    }
  }, [isTickingEnabled]);

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    isTickingEnabled ? 1000 : null,
  );

  return (
    <TransactionsRelativeTimeContext.Provider value={nowMs}>
      {children}
    </TransactionsRelativeTimeContext.Provider>
  );
}

interface ITransactionRelativeTimeProps {
  timestamp: number;
  color?: ISizableTextProps['color'];
  size?: ISizableTextProps['size'];
  textProps?: Omit<ISizableTextProps, 'children' | 'color' | 'size'>;
}

function TransactionRelativeTimeBase({
  timestamp,
  color = '$textSubdued',
  size = '$bodyMd',
  textProps,
}: ITransactionRelativeTimeProps) {
  const nowMs = useContext(TransactionsRelativeTimeContext);
  const formattedTime = useMemo(
    () => formatRelativeTimeAbbrAt(timestamp, nowMs),
    [timestamp, nowMs],
  );

  return (
    <SizableText size={size} color={color} {...textProps}>
      {formattedTime}
    </SizableText>
  );
}

export const TransactionRelativeTime = memo(TransactionRelativeTimeBase);
