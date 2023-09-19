import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { Box, FlatList } from '@onekeyhq/components';

import { useHomeTabName } from '../hooks/useHomeTabName';

import DelayedFreeze from './DelayedFreeze';

import type { WalletHomeTabEnum } from '../views/Wallet/type';

export type ILazyRenderCurrentHomeTabProps = PropsWithChildren<{
  freezeType?: 'unmount' | 'freeze';
  children?: any;
  homeTabName: WalletHomeTabEnum | undefined;
}>;

export function LazyRenderCurrentHomeTab({
  children,
  homeTabName,
  freezeType,
}: ILazyRenderCurrentHomeTabProps) {
  const isFocusedRef = useRef(false);
  const currentHomeTabName = useHomeTabName();
  const isFocused = homeTabName === currentHomeTabName;

  useEffect(() => {
    if (isFocused) {
      isFocusedRef.current = true;
    }
  }, [isFocused]);

  const shouldFreeze = !isFocused;

  const empty = useMemo(
    // TODO render Skeleton
    () => <FlatList data={[]} renderItem={() => <Box />} />,
    [],
  );

  const renderChildren = useMemo(() => {
    if (shouldFreeze && freezeType === 'unmount') {
      // TODO android should return empty FlatList?
      return empty;
    }
    if (isFocusedRef.current || isFocused) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return children;
    }
    // NativeNestedTabView required non-null children
    return empty;
  }, [children, empty, freezeType, isFocused, shouldFreeze]);
  // return <>{renderChildren}</>;

  if (shouldFreeze && freezeType === 'freeze') {
    return <DelayedFreeze freeze>{renderChildren}</DelayedFreeze>;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return renderChildren;
}
