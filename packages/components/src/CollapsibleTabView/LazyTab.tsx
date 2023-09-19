import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { FlatList } from 'react-native';

import DelayedFreeze from '../DelayedFreeze';
import { Stack } from '../Stack';

import { useActiveTab } from './ActiveTabContext';

import type { ScrollView } from 'react-native';

enum RenderStatus {
  NotRendered = 0,
  Rendered = 1,
  Destroyed = -1,
}

const LazyTabComponent = ({
  children,
  name,
  freezeType,
  autoDestroy = false,
}: LazyTabProps) => {
  const { activeTabName } = useActiveTab();
  const isCurrentTab = useMemo(
    () => name === activeTabName,
    [name, activeTabName],
  );
  const [status, setStatus] = useState<RenderStatus>(RenderStatus.NotRendered);
  const destroyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isCurrentTab && status !== RenderStatus.Rendered) {
      setStatus(RenderStatus.Rendered);
      if (destroyTimeoutRef.current) {
        clearTimeout(destroyTimeoutRef.current);
        destroyTimeoutRef.current = null;
      }
    } else if (
      (!isCurrentTab &&
        typeof autoDestroy === 'number' &&
        status === RenderStatus.Rendered) ||
      autoDestroy === true
    ) {
      destroyTimeoutRef.current = setTimeout(
        () => {
          setStatus(RenderStatus.Destroyed);
        },
        typeof autoDestroy === 'number' ? autoDestroy : 0,
      );
    }
    return () => {
      if (destroyTimeoutRef.current) {
        clearTimeout(destroyTimeoutRef.current);
      }
    };
  }, [isCurrentTab, autoDestroy, status]);

  const empty = useMemo(
    // TODO render Skeleton
    () => <FlatList data={[]} renderItem={() => <Stack />} />,
    [],
  );

  const renderedContent = useMemo(() => {
    if (
      status === RenderStatus.NotRendered ||
      status === RenderStatus.Destroyed
    ) {
      return empty;
    }
    return children;
  }, [status, empty, children]);

  const lazyContentMemo = useMemo(() => {
    if (!isCurrentTab && freezeType === 'freeze') {
      return <DelayedFreeze freeze>{renderedContent}</DelayedFreeze>;
    }
    return null;
  }, [isCurrentTab, freezeType, renderedContent]);

  return lazyContentMemo || renderedContent;
};

export const LazyTab = memo(LazyTabComponent);

type LazyTabProps = {
  children: ReactElement<
    | typeof FlatList
    // | typeof FlatListPlain
    | typeof Selection
    | typeof ScrollView
  >;
  name: string;
  label: string;
  freezeType?: 'unmount' | 'freeze';
  autoDestroy?: true | false | number;
};
