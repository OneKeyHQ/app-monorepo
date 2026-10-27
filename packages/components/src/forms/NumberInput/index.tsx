import { forwardRef, useMemo } from 'react';

import { Input } from '../Input';
import { getSharedInputStyles } from '../Input/sharedStyles';

import type { IInputProps, IInputRef } from '../Input';

export type INumberInputProps = Omit<
  IInputProps,
  'addOns' | 'leftAddOnProps'
> & {
  /** Show decrement and increment buttons around the input. Defaults to false. */
  showControls?: boolean;
  /** The caller applies the step and any domain-specific numeric limits. */
  onStep?: (direction: -1 | 1) => void;
};

const sizes = {
  small: { width: 128, controlPadding: '$1' },
  medium: { width: 148, controlPadding: '$1.5' },
  large: { width: 164, controlPadding: '$2.5' },
} as const;

export const NumberInput = forwardRef<IInputRef, INumberInputProps>(
  function NumberInput(
    {
      showControls = false,
      onStep,
      size = 'medium',
      disabled,
      readonly,
      editable,
      accessibilityLabel,
      containerProps,
      testID,
      keyboardType = 'decimal-pad',
      ...props
    },
    ref,
  ) {
    const controlRadius =
      containerProps?.borderRadius ??
      getSharedInputStyles({ size }).borderRadius;
    const controls = useMemo<
      Pick<IInputProps, 'leftAddOnProps' | 'addOns' | 'textAlign' | 'pl' | 'pr'>
    >(() => {
      if (!showControls) {
        return {};
      }
      const controlsDisabled =
        disabled || readonly || editable === false || !onStep;
      const controlProps = {
        disabled: controlsDisabled,
        iconColor: controlsDisabled ? '$iconDisabled' : '$iconSubdued',
        role: 'button',
        tabIndex: controlsDisabled ? -1 : 0,
        px: sizes[size].controlPadding,
        // Explicit corners preserve both buttons' curves inside Input's groups.
        borderTopLeftRadius: controlRadius,
        borderTopRightRadius: controlRadius,
        borderBottomLeftRadius: controlRadius,
        borderBottomRightRadius: controlRadius,
      } as const;
      const decrementLabel = accessibilityLabel
        ? `${accessibilityLabel} −`
        : '−';
      const incrementLabel = accessibilityLabel
        ? `${accessibilityLabel} +`
        : '+';
      return {
        textAlign: 'center',
        pl: '$0',
        pr: '$0',
        leftAddOnProps: {
          ...controlProps,
          testID: testID ? `${testID}-decrement` : undefined,
          iconName: 'MinusSmallOutline',
          accessibilityLabel: decrementLabel,
          'aria-label': decrementLabel,
          onPress: controlsDisabled ? undefined : () => onStep?.(-1),
        },
        addOns: [
          {
            ...controlProps,
            testID: testID ? `${testID}-increment` : undefined,
            iconName: 'PlusSmallOutline',
            accessibilityLabel: incrementLabel,
            'aria-label': incrementLabel,
            onPress: controlsDisabled ? undefined : () => onStep?.(1),
          },
        ],
      };
    }, [
      accessibilityLabel,
      controlRadius,
      disabled,
      editable,
      onStep,
      readonly,
      showControls,
      size,
      testID,
    ]);
    const inputContainerProps = useMemo(
      () => ({ width: sizes[size].width, ...containerProps }),
      [containerProps, size],
    );

    return (
      <Input
        ref={ref}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        readonly={readonly}
        editable={editable}
        size={size}
        containerProps={inputContainerProps}
        keyboardType={keyboardType}
        returnKeyType="done"
        autoCorrect={false}
        selectTextOnFocus
        {...controls}
        {...props}
      />
    );
  },
);
