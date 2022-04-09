import React, {
  ComponentProps,
  ReactElement,
  cloneElement,
  useCallback,
} from 'react';

import { Controller, ControllerProps, FieldValues } from 'react-hook-form';

import Box from '../Box';
import FormControl from '../FormControl';
import Icon from '../Icon';
import IconButton from '../IconButton';
import Stack from '../Stack';
import Typography from '../Typography';
import { getClipboard } from '../utils/ClipboardUtils';

type InternalActionList = 'paste';

type FormItemProps = {
  label?: string;
  labelAddon?: ReactElement | InternalActionList[];
  helpText?: string | ((v: any) => string);
  children?: ReactElement<any>;
  formControlProps?: ComponentProps<typeof FormControl>;
};

export function FormItem<TFieldValues extends FieldValues = FieldValues>({
  label,
  helpText,
  children,
  name,
  rules,
  defaultValue,
  formControlProps,
  labelAddon,
  ...props
}: Omit<ControllerProps<TFieldValues>, 'render'> & FormItemProps) {
  const handleCopied = useCallback(async (callback: (c: string) => void) => {
    try {
      const str = await getClipboard();
      callback?.(str);
    } catch (e) {
      callback?.('');
    }
  }, []);
  return (
    <Controller
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      {...props}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => (
        <FormControl isInvalid={!!error} width="full" {...formControlProps}>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            {!!label && (
              <FormControl.Label mb={0}>
                <Typography.Body2Strong>{label}</Typography.Body2Strong>
              </FormControl.Label>
            )}

            {Array.isArray(labelAddon) ? (
              <Stack direction="row" space="2">
                {labelAddon.map((item, i) => {
                  if (item === 'paste') {
                    return (
                      <IconButton
                        key={i}
                        type="plain"
                        size="xs"
                        circle
                        name="ClipboardSolid"
                        onPress={() => handleCopied(onChange)}
                      />
                    );
                  }
                  return null;
                })}
              </Stack>
            ) : (
              labelAddon
            )}
          </Box>
          {children
            ? cloneElement(children, { onChange, onBlur, value })
            : null}
          {helpText ? (
            <FormControl.HelperText>
              <Typography.Body2 color="text-subdued">
                {typeof helpText === 'function' ? helpText(value) : helpText}
              </Typography.Body2>
            </FormControl.HelperText>
          ) : null}
          {error ? (
            <Box display="flex" flexDirection="row" mt="2">
              <Box mr="2">
                <Icon
                  size={20}
                  name="ExclamationCircleSolid"
                  color="icon-critical"
                />
              </Box>
              <Typography.Body2 color="text-critical">
                {error?.message}
              </Typography.Body2>
            </Box>
          ) : null}
        </FormControl>
      )}
    />
  );
}
