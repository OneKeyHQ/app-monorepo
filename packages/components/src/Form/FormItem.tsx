import type { ComponentProps, ReactElement } from 'react';
import { cloneElement, useCallback } from 'react';

import { Controller } from 'react-hook-form';
import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { gotoScanQrcode } from '@onekeyhq/kit/src/utils/gotoScanQrcode';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';
import FormControl from '../FormControl';
import IconButton from '../IconButton';
import Stack from '../Stack';
import Typography from '../Typography';
import { getClipboard } from '../utils/ClipboardUtils';

import { FormControlMessage } from './FormControlMessage';

import type { ICON_NAMES } from '../Icon';
import type { TextAreaAction } from '../Textarea';
import type { ControllerProps, FieldValues } from 'react-hook-form';

type InternalActionList = 'paste' | 'scan';

type FormItemProps = {
  label?: string | ReactElement;
  labelAddon?: ReactElement | InternalActionList[];
  isLabelAddonActions?: boolean;
  helpText?: string | ((v: any) => string | ReactElement) | ReactElement;
  successMessage?: string | undefined;
  warningMessage?: string | undefined;
  errorMessage?: string | undefined;
  isValidating?: boolean;
  onLabelAddonPress?: () => void;
  children?: ReactElement<any>;
  formControlProps?: ComponentProps<typeof FormControl>;
};

export function FormItem<TFieldValues extends FieldValues = FieldValues>({
  label,
  helpText,
  successMessage,
  warningMessage,
  errorMessage,
  children,
  name,
  rules,
  defaultValue,
  formControlProps,
  labelAddon,
  isLabelAddonActions,
  onLabelAddonPress,
  isValidating,
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
  const small = useIsVerticalLayout();
  const intl = useIntl();

  return (
    <Controller
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      {...props}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => {
        const onPasteClick = async () => {
          await handleCopied(onChange);
          onLabelAddonPress?.();
        };
        const onScanClick = () => {
          gotoScanQrcode((result) => {
            onChange(result);
            onLabelAddonPress?.();
          });
        };
        const renderLabelAddon = () => {
          if (isLabelAddonActions) {
            return null;
          }
          if (Array.isArray(labelAddon)) {
            return (
              <Stack direction="row" space="2">
                {labelAddon.map((item, i) => {
                  if (item === 'paste' && platformEnv.canGetClipboard) {
                    return (
                      <IconButton
                        key={i}
                        type="plain"
                        size="xs"
                        circle
                        name="ClipboardMini"
                        onPress={onPasteClick}
                      />
                    );
                  }
                  if (item === 'scan') {
                    return (
                      <IconButton
                        key={i}
                        type="plain"
                        size="xs"
                        circle
                        name={
                          small
                            ? 'ViewfinderCircleOutline'
                            : 'ViewfinderCircleMini'
                        }
                        onPress={onScanClick}
                      />
                    );
                  }
                  return null;
                })}
              </Stack>
            );
          }
          return labelAddon;
        };
        let actions: Array<TextAreaAction | null> | undefined;
        if (isLabelAddonActions && Array.isArray(labelAddon)) {
          actions = labelAddon
            .map((item) => {
              if (item === 'paste' && platformEnv.canGetClipboard) {
                return {
                  icon: 'ClipboardMini' as ICON_NAMES,
                  text: intl.formatMessage({ id: 'action__paste' }),
                  onPress: onPasteClick,
                };
              }
              if (item === 'scan') {
                return {
                  icon: 'ViewfinderCircleMini' as ICON_NAMES,
                  text: intl.formatMessage({ id: 'action__scan' }),
                  onPress: onScanClick,
                };
              }
              return null;
            })
            .filter(Boolean);
        }

        return (
          <FormControl isInvalid={!!error} width="full" {...formControlProps}>
            {(!!label || !isLabelAddonActions) && (
              <Box
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                mb={label ? 1 : 0}
              >
                {!!label && (
                  <FormControl.Label mb={0}>
                    {typeof label === 'string' ? (
                      <Typography.Body2Strong>{label}</Typography.Body2Strong>
                    ) : (
                      label
                    )}
                  </FormControl.Label>
                )}

                {renderLabelAddon()}
              </Box>
            )}

            {children
              ? cloneElement(children, { onChange, onBlur, value, actions })
              : null}
            {helpText ? (
              <FormControl.HelperText>
                {typeof helpText === 'function' ? (
                  helpText(value)
                ) : (
                  <Typography.Body2 color="text-subdued">
                    {helpText}
                  </Typography.Body2>
                )}
              </FormControl.HelperText>
            ) : null}
            {error && error?.message ? (
              <FormControlMessage type="error" message={error?.message} />
            ) : null}
            {!error && errorMessage ? (
              <FormControlMessage type="error" message={errorMessage} />
            ) : null}
            {warningMessage ? (
              <FormControlMessage type="warning" message={warningMessage} />
            ) : null}
            {successMessage ? (
              <FormControlMessage type="success" message={successMessage} />
            ) : null}
            {isValidating ? <Box height={7} /> : null}
          </FormControl>
        );
      }}
    />
  );
}
