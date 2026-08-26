import {
  Fragment,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { Stack } from '../primitives';

import { TooltipText } from './Tooltip/TooltipText';

import type { ITooltipProps } from './Tooltip';
import type { IStackProps } from '../primitives';

type ILazyTooltipComponent = typeof import('./Tooltip').Tooltip;
type ITriggerFallbackProps = {
  disabled?: boolean;
  onFocus?: IStackProps['onFocus'];
  onHoverIn?: IStackProps['onHoverIn'];
  onPress?: IStackProps['onPress'];
};
type ITriggerFocusArgs = Parameters<NonNullable<IStackProps['onFocus']>>;
type ITriggerHoverInArgs = Parameters<NonNullable<IStackProps['onHoverIn']>>;
type ITriggerPressArgs = Parameters<NonNullable<IStackProps['onPress']>>;

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

function logTooltipLoadError(error: unknown) {
  const err = error as { message?: string; stack?: string };
  defaultLogger.app.error.log(
    `[LazyTooltip] FAILED: ${err?.message || String(error)}\n${err?.stack?.slice(0, 300) || ''}`,
  );
}

export function preloadLazyTooltip() {
  return loadTooltip();
}

function LazyTooltipFrame(props: ITooltipProps & ITriggerFallbackProps) {
  const [TooltipComponent, setTooltipComponent] = useState<
    ILazyTooltipComponent | undefined
  >(() => loadedTooltip);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const ensureLoaded = useCallback(() => {
    void loadTooltip()
      .then((Component) => {
        if (!isMountedRef.current) {
          return;
        }
        setTooltipComponent(() => Component);
      })
      .catch((error: unknown) => {
        logTooltipLoadError(error);
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
    const handleHoverIn = (...args: ITriggerHoverInArgs) => {
      triggerProps.onHoverIn?.(...args);
      ensureLoaded();
    };
    const handleFocus = (...args: ITriggerFocusArgs) => {
      triggerProps.onFocus?.(...args);
      ensureLoaded();
    };
    const handlePress = (...args: ITriggerPressArgs) => {
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
