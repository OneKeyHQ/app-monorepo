/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { ComponentProps, FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import Box from '../Box';
import Divider from '../Divider';
import Input from '../Input';
import RadioButton from '../RadioButton';
import Typography from '../Typography';

import type { LocaleIds } from '../locale';
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

type NumberInputProps = ComponentProps<typeof Input> & {
  decimal?: number;
  onChange?: (text: string) => void;
  onFocus?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onChangeText?: (text: string) => void;
  enableMaxButton?: boolean;
  isMax?: boolean;
  onMaxChange?: (isMax: boolean) => void;
  maxText?: string;
  maxButtonTranslationId?: LocaleIds;
  maxTextIsNumber?: boolean;
  maxModeCanEdit?: boolean;
  tokenSymbol?: string;
};

function fixNumberValue(t: string, decimal?: number) {
  let text = t
    .replace(/。/g, '.')
    .replace(/[^\\.0-9]/g, '')
    .replace(/^0+(\d)/, '$1');
  try {
    if (text.startsWith('.')) {
      const b = new BigNumber(text);
      if (!b.isNaN()) {
        text = b.toString();
      }
    }
  } catch (error) {
    console.log(error);
  }

  let result = text;
  if (text) {
    result = text.replace(/^\D*(\d*(?:\.\d*)?)/g, '$1');

    if (decimal === 0) {
      result = result.replace('.', '');
    }

    // limit max decimal
    if (decimal && decimal > 0) {
      const position = text.indexOf('.');
      if (position !== -1 && text.length - 1 - position > decimal) {
        result = text.substring(0, position + decimal + 1);
      }
    }
  }
  return result;
}

const NumberInput: FC<NumberInputProps> = ({
  decimal,
  onChange,
  onFocus,
  enableMaxButton,
  isMax,
  onMaxChange,
  maxText,
  maxTextIsNumber,
  maxModeCanEdit,
  onBlur,
  onChangeText,
  tokenSymbol,
  value,
  size,
  maxButtonTranslationId,
  ...props
}) => {
  const intl = useIntl();
  const inputRef = useRef(null);
  // eslint-disable-next-line no-param-reassign
  maxText = maxText || intl.formatMessage({ id: 'form__amount_max_amount' });
  const [v, setV] = useState('');

  const maxButton = useMemo(
    () =>
      enableMaxButton ? (
        <RadioButton
          size={size === 'xl' ? 'lg' : 'sm'}
          value="true"
          isChecked={isMax}
          onCheckedChange={(checked) => {
            onMaxChange?.(checked);
            if (!checked && isMax) {
              // @ts-expect-error
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              inputRef?.current?.focus();
            }
          }}
          title={intl.formatMessage({
            id: maxButtonTranslationId ?? 'action__max',
          })}
        />
      ) : undefined,
    [enableMaxButton, intl, isMax, onMaxChange, size, maxButtonTranslationId],
  );

  const handleChange = useCallback(
    (t: string) => {
      const result = fixNumberValue(t, decimal);
      setV(result);
      if (onChange) {
        onChange(result);
      }
      if (onChangeText) {
        onChangeText(result);
      }
    },
    [decimal, onChange, onChangeText],
  );

  const handleBlur = useCallback(
    (e: any) => {
      const text = v;

      if (text) {
        if (text.startsWith('.') || text.endsWith('.')) {
          const b = new BigNumber(text);

          if (onChange) {
            onChange(b.toString());
          }
          setV(b.toString());
        }
      }

      if (onBlur) {
        onBlur(e);
      }
    },
    [onBlur, onChange, v],
  );

  const valueDisplay = useMemo(() => {
    let val = value;
    if (enableMaxButton && isMax) {
      val = maxText;
      if (maxTextIsNumber) {
        try {
          val = fixNumberValue(val as string, decimal);
        } catch (error) {
          console.error(error);
        }
      }
    }
    return val;
  }, [decimal, enableMaxButton, isMax, maxText, maxTextIsNumber, value]);

  // TODO render native-base NumberInput in ios/android
  //    https://github.com/GeekyAnts/NativeBase/issues/3894
  return (
    <Input
      ref={inputRef}
      keyboardType="numeric"
      rightCustomElement={
        <>
          <Typography.Body1 color="text-subdued">
            {tokenSymbol}
          </Typography.Body1>
          {enableMaxButton ? (
            <Divider orientation="vertical" h={5} ml={5} mr={1} />
          ) : null}
          {maxButton}
          <Box w={1} />
        </>
      }
      isReadOnly={!maxModeCanEdit && enableMaxButton && isMax}
      onFocus={(e) => {
        onFocus?.(e);
        if (isMax && maxModeCanEdit) {
          onMaxChange?.(!isMax);
          if (valueDisplay) {
            handleChange(valueDisplay);
          }
        }
      }}
      size={size}
      {...props}
      value={valueDisplay}
      onChangeText={handleChange}
      onBlur={handleBlur}
    />
  );
};
export default NumberInput;
