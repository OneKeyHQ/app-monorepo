import { useState } from 'react';

import { getVariableValue, styled } from '@tamagui/core';
import { createContextScope } from '@tamagui/create-context';
import { getSize } from '@tamagui/get-token';
import { withStaticProperties } from '@tamagui/helpers';
import { ThemeableStack } from '@tamagui/stacks';

import type { GetProps } from '@tamagui/core';
import type { Scope } from '@tamagui/create-context';
import type { LayoutChangeEvent } from 'react-native';

const PROGRESS_NAME = 'Progress';

const [createProgressContext, createProgressScope] =
  createContextScope(PROGRESS_NAME);
type IProgressContextValue = {
  value: number | null;
  max: number;
  width: number;
};
const [ProgressProvider, useProgressContext] =
  createProgressContext<IProgressContextValue>(PROGRESS_NAME);

const INDICATOR_NAME = 'ProgressIndicator';

function defaultGetValueLabel(value: number, max: number) {
  return `${Math.round((value / max) * 100)}%`;
}

function getProgressState(
  value: number | undefined | null,
  maxValue: number,
): IProgressState {
  if (value == null) {
    return 'indeterminate';
  }
  if (value === maxValue) {
    return 'complete';
  }
  return 'loading';
}

function isNumber(value: any): value is number {
  return typeof value === 'number';
}

function isValidMaxNumber(max: any): max is number {
  return isNumber(max) && !Number.isNaN(max) && max > 0;
}

function isValidValueNumber(value: any, max: number): value is number {
  return isNumber(value) && !Number.isNaN(value) && value <= max && value >= 0;
}

export const ProgressIndicatorFrame = styled(ThemeableStack, {
  name: INDICATOR_NAME,

  variants: {
    unstyled: {
      false: {
        height: '100%',
        width: '100%',
        backgrounded: true,
      },
    },
  } as const,

  defaultVariants: {
    unstyled: process.env.TAMAGUI_HEADLESS === '1',
  },
});

export type IProgressIndicatorProps = GetProps<typeof ProgressIndicatorFrame>;

const ProgressIndicator = ProgressIndicatorFrame.styleable<
  IProgressIndicatorProps,
  any,
  any
>(
  (
    props: IProgressIndicatorProps & { __scopeProgress?: any },
    forwardedRef: any,
  ) => {
    const { __scopeProgress, animation, ...indicatorProps } = props;
    const context = useProgressContext(INDICATOR_NAME, __scopeProgress);
    const pct = context.max - (context.value ?? 0);
    // default somewhat far off
    const x = -(context.width === 0 ? 300 : context.width) * (pct / 100);

    return (
      <ProgressIndicatorFrame
        data-state={getProgressState(context.value, context.max)}
        data-value={context.value ?? undefined}
        data-max={context.max}
        x={x}
        width={context.width}
        {...(!props.unstyled && {
          animateOnly: ['transform'],
          opacity: context.width === 0 ? 0 : 1,
        })}
        {...indicatorProps}
        ref={forwardedRef}
        // avoid animation on first render so the progress doesn't bounce to initial location
        animation={!context.width ? null : animation}
      />
    );
  },
);

const DEFAULT_MAX = 100;

type IScopedProps<P> = P & { __scopeProgress?: Scope };

type IProgressState = 'indeterminate' | 'complete' | 'loading';

export const ProgressFrame = styled(ThemeableStack, {
  name: 'Progress',

  variants: {
    unstyled: {
      false: {
        borderRadius: 100_000,
        overflow: 'hidden',
        backgrounded: true,
      },
    },

    size: {
      '...size': (val, { props }) => {
        const widthVal = props.width || props.w;
        let width = 0;
        if (widthVal) {
          width =
            typeof widthVal === 'number'
              ? widthVal
              : getVariableValue(getSize(widthVal as any));
        }

        const size = Math.round(getVariableValue(getSize(val)) * 0.25);
        const minWidth = getVariableValue(size) * 20;
        return {
          height: size,
          minWidth: width ? Math.min(width, minWidth) : minWidth,
          width: '100%',
        };
      },
    },
  } as const,

  defaultVariants: {
    unstyled: process.env.TAMAGUI_HEADLESS === '1',
  },
});

export interface IProgressExtraProps {
  value?: number | null | undefined;
  max?: number;
  getValueLabel?(value: number, max: number): string;
}

export type IProgressProps = GetProps<typeof ProgressFrame> &
  IProgressExtraProps;

const Progress = withStaticProperties(
  ProgressFrame.styleable<IProgressExtraProps, any, any>(
    (
      props: IProgressExtraProps & {
        __scopeProgress?: any;
        size?: any;
        unstyled?: any;
        onLayout?: (event: LayoutChangeEvent) => void;
      },
      forwardedRef: any,
    ) => {
      const {
        __scopeProgress,
        value: valueProp,
        max: maxProp,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        getValueLabel = defaultGetValueLabel,
        size = '$true',
        ...IProgressProps
      } = props;

      const max = isValidMaxNumber(maxProp) ? maxProp : DEFAULT_MAX;
      const value = isValidValueNumber(valueProp, max) ? valueProp : null;
      const valueLabel = isNumber(value)
        ? getValueLabel(value, max)
        : undefined;
      const [width, setWidth] = useState(0);

      return (
        <ProgressProvider
          scope={__scopeProgress}
          value={value}
          max={max}
          width={width}
        >
          <ProgressFrame
            aria-valuemax={max}
            aria-valuemin={0}
            aria-valuenow={isNumber(value) ? value : undefined}
            aria-valuetext={valueLabel}
            // @ts-ignore
            role="progressbar"
            data-state={getProgressState(value, max)}
            data-value={value ?? undefined}
            data-max={max}
            {...(IProgressProps.unstyled !== true && {
              size,
            })}
            {...IProgressProps}
            onLayout={(e) => {
              setWidth(e.nativeEvent.layout.width);
              IProgressProps.onLayout?.(e);
            }}
            ref={forwardedRef}
          />
        </ProgressProvider>
      );
    },
  ),
  {
    Indicator: ProgressIndicator,
  },
);

export { createProgressScope, Progress, ProgressIndicator };
