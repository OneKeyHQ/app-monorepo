import React from 'react';

import { Badge } from '@onekeyhq/components';

const counterCache = new Map<string, number>();

function useRenderCounter(label = 'default') {
  const count = counterCache.get(label) || 0;

  if (typeof count === 'undefined') {
    counterCache.set(label, 0);
  } else {
    counterCache.set(label, count + 1);
  }
  console.log(`${label} render count:`, count);
  return counterCache.get(label) as number;
}

const RenderCounter = ({ label }: { label: string | number }) => {
  const count = useRenderCounter(label.toString());

  return <Badge title={count.toString()} type="Critical" size="sm" />;
};

export default RenderCounter;
