import type { PropsWithChildren } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import { max } from 'lodash';
import { FlatList } from 'react-native';

import DelayedFreeze from '../DelayedFreeze';

import {
  TabStatusContext,
  useActiveTabContext,
} from './Provider/ActiveTabContext';

type RenderStatus = 'none' | 'rendered' | 'freeze';

export type TabWrapperProps = {
  route: {
    key: string;
    title: string;
  };
  lazy?: boolean;
  freezeType?: 'unmount' | 'freeze';
  autoFreeze?: true | false | number;
};

type FreezeTabProps = PropsWithChildren<TabWrapperProps>;

const DefaultProps = {
  lazy: true,
  freezeType: 'freeze',
  autoFreeze: false,
} as const;

const FreezeTabComponent = ({
  children,
  route,
  lazy,
  freezeType,
  autoFreeze,
}: FreezeTabProps) => {
  const { activeTabKey } = useActiveTabContext();
  const isCurrentTab = useMemo(
    () => route.key === activeTabKey,
    [route.key, activeTabKey],
  );
  const initialStatus = lazy && !isCurrentTab ? 'none' : 'rendered';
  const [status, setStatus] = useState<RenderStatus>(initialStatus);

  useEffect(() => {
    let freezeTimeout: NodeJS.Timeout | null = null;

    if (isCurrentTab && status !== 'rendered') {
      setStatus('rendered');
    } else if (
      status !== 'none' &&
      !isCurrentTab &&
      (autoFreeze === true || typeof autoFreeze === 'number')
    ) {
      const delay = typeof autoFreeze === 'number' ? max([autoFreeze, 0]) : 0;
      freezeTimeout = setTimeout(() => setStatus('freeze'), delay);
    }

    return () => {
      if (freezeTimeout) {
        clearTimeout(freezeTimeout);
      }
    };
  }, [isCurrentTab, autoFreeze, status]);

  const placeholder = useMemo(
    () => <FlatList data={[]} renderItem={null} />,
    [],
  );

  const tabStatusProviderValue = useMemo(
    () => ({ isTabActive: isCurrentTab }),
    [isCurrentTab],
  );

  const childMemo = useMemo(
    () => (
      <TabStatusContext.Provider value={tabStatusProviderValue}>
        {children}
      </TabStatusContext.Provider>
    ),
    [children, tabStatusProviderValue],
  );

  const renderedContent = useMemo(() => {
    if (lazy && !isCurrentTab && status === 'none') {
      return placeholder;
    }

    if (freezeType === 'unmount' && status === 'freeze') {
      return placeholder;
    }

    return childMemo;
  }, [lazy, isCurrentTab, status, freezeType, childMemo, placeholder]);

  return useMemo(() => {
    if (freezeType === 'unmount' && status === 'freeze') {
      return null;
    }

    return (
      <DelayedFreeze freeze={freezeType === 'freeze' && status === 'freeze'}>
        {renderedContent}
      </DelayedFreeze>
    );
  }, [freezeType, renderedContent, status]);
};

FreezeTabComponent.defaultProps = DefaultProps;
export const FreezeTab = memo(FreezeTabComponent);
