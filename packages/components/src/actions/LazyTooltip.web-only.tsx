import {
  Fragment,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { Stack } from '../primitives';

import { TooltipText } from './Tooltip/TooltipText';

import type { ITooltipProps } from './Tooltip';

type ILazyTooltipComponent = typeof import('./Tooltip').Tooltip;
type ITriggerEventHandler = (...args: unknown[]) => void;
type ITriggerFallbackProps = {
  disabled?: boolean;
  onFocus?: ITriggerEventHandler;
  onHoverIn?: ITriggerEventHandler;
  onPress?: ITriggerEventHandler;
};

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

export function preloadLazyTooltip() {
  return loadTooltip();
}

function LazyTooltipFrame(props: ITooltipProps & ITriggerFallbackProps) {
  const [TooltipComponent, setTooltipComponent] = useState<
    ILazyTooltipComponent | undefined
  >(() => loadedTooltip);

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

  if (
    isValidElement<ITriggerFallbackProps>(props.renderTrigger) &&
    props.renderTrigger.type !== Fragment
  ) {
    const triggerProps = props.renderTrigger.props;
    const handleHoverIn = (...args: unknown[]) => {
      triggerProps.onHoverIn?.(...args);
      ensureLoaded();
    };
    const handleFocus = (...args: unknown[]) => {
      triggerProps.onFocus?.(...args);
      ensureLoaded();
    };
    const handlePress = (...args: unknown[]) => {
      triggerProps.onPress?.(...args);
      props.onPress?.(...args);
      ensureLoaded();
    };

    return cloneElement<ITriggerFallbackProps>(props.renderTrigger, {
      disabled: props.disabled ?? triggerProps.disabled,
      onFocus: handleFocus,
      onHoverIn: handleHoverIn,
      ...(props.onPress || triggerProps.onPress
        ? {
            onPress: handlePress,
          }
        : undefined),
    });
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
