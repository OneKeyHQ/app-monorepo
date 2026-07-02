import { useCallback, useEffect, useState } from 'react';

import { Stack } from '../primitives';

import { TooltipText } from './Tooltip/TooltipText';

import type { ITooltipProps } from './Tooltip';

type ILazyTooltipComponent = typeof import('./Tooltip').Tooltip;

let loadedTooltip: ILazyTooltipComponent | undefined;
let loadTooltipPromise: Promise<ILazyTooltipComponent> | undefined;

function loadTooltip() {
  if (!loadTooltipPromise) {
    const promise = import('./Tooltip')
      .then((module) => {
        loadedTooltip = module.Tooltip;
        return module.Tooltip;
      })
      .catch((error: unknown) => {
        if (loadTooltipPromise === promise) {
          loadTooltipPromise = undefined;
        }
        throw error;
      });
    loadTooltipPromise = promise;
  }
  return loadTooltipPromise;
}

function LazyTooltipFrame(props: ITooltipProps) {
  const [TooltipComponent, setTooltipComponent] = useState<
    ILazyTooltipComponent | undefined
  >(loadedTooltip);

  const ensureLoaded = useCallback(() => {
    void loadTooltip()
      .then((Component) => {
        setTooltipComponent(() => Component);
      })
      .catch((error: Error) => {
        console.error('Failed to load Tooltip:', error);
      });
  }, []);

  useEffect(() => {
    if (props.open && !TooltipComponent) {
      ensureLoaded();
    }
  }, [ensureLoaded, props.open, TooltipComponent]);

  if (TooltipComponent) {
    return <TooltipComponent {...props} />;
  }

  return (
    <Stack display="contents" onHoverIn={ensureLoaded}>
      {props.renderTrigger}
    </Stack>
  );
}

export const LazyTooltip = Object.assign(LazyTooltipFrame, {
  Text: TooltipText,
});

export type { ITooltipProps };
