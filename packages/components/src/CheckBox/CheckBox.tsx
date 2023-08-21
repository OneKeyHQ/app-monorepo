import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

import { Checkbox as BaseCheckBox } from 'native-base';

import Box from '../Box';
import Pressable from '../Pressable';
import Typography from '../Typography';

import { getCheckBoxIcon } from './CheckBoxIcon';

import type { IBoxProps } from 'native-base';

export type CheckBoxProps = {
  name?: string;
  value?: string;
  /**
   * 选中状态
   */
  isChecked?: boolean;
  /**
   * 默认选中
   */
  defaultIsChecked?: boolean;
  /**
   * 选择说明标题
   */
  title?: string;
  /**
   * 选择说明详细内容
   */
  description?: string;
  /**
   * 是否有焦点
   */
  focusable?: boolean;
  /**
   * 是否禁用
   */
  isDisabled?: boolean;
  /**
   * 点击监听
   */
  onChange?: (isSelected: boolean) => void;
  /**
   * 多选时未选中全部
   */
  isIndeterminate?: boolean;
  containerStyle?: ComponentProps<typeof Box>;
  checkBoxProps?: Partial<ComponentProps<typeof BaseCheckBox>>;
} & ComponentProps<typeof Box>;

const defaultProps = {
  isChecked: false,
  focusable: false,
  isDisabled: false,
  hasDefault: false,
} as const;

const CheckBox: FC<CheckBoxProps> = ({
  value = '',
  name,
  isChecked,
  title,
  description,
  defaultIsChecked,
  focusable,
  isDisabled,
  onChange,
  children,
  containerStyle,
  checkBoxProps,
  isIndeterminate,
  ...props
}) => {
  let titleColor = 'text-default';
  let descriptionColor = 'text-subdued';

  if (isDisabled) {
    titleColor = 'text-disabled';
    descriptionColor = 'text-disabled';
  }
  const { ...boxProps } = props as IBoxProps;

  const onChangeCallback = useMemo(
    () => (!isDisabled ? onChange : undefined),
    [isDisabled, onChange],
  );

  return (
    <Box
      {...boxProps}
      display="flex"
      flexDirection="row"
      alignItems="flex-start"
    >
      <Box
        mr="3"
        h="5"
        justifyContent="flex-end"
        display="flex"
        {...containerStyle}
      >
        <BaseCheckBox
          value={value}
          name={name}
          onChange={onChangeCallback}
          icon={getCheckBoxIcon({
            disable: Boolean(isDisabled),
            defaultIsChecked: Boolean(defaultIsChecked),
            indeterminate: Boolean(isIndeterminate),
          })}
          defaultIsChecked={defaultIsChecked}
          isChecked={isChecked}
          focusable={focusable}
          isDisabled={isDisabled}
          accessibilityLabel={title}
          borderRadius="md"
          borderColor="border-default"
          bg="surface-default"
          _icon={{
            color: isDisabled ? 'icon-default' : 'icon-on-primary',
          }}
          _text={{
            color: 'text-default',
            fontWeight: '500',
            selectable: false,
            fontSize: 16,
            lineHeight: 24,
          }}
          _hover={{
            value,
            _interactionBox: {
              value,
              bg: 'surface-hovered',
            },
          }}
          _focus={{
            value,
            _interactionBox: {
              value,
              bg: 'action-primary-focus',
            },
          }}
          // @ts-expect-error
          _focusVisible={{
            _interactionBox: {
              bg: 'action-primary-focus',
            },
          }}
          _checked={{
            value,
            bg: 'action-primary-default',
            borderColor: 'action-primary-default',
            _hover: {
              borderColor: 'action-primary-hovered',
              bg: 'action-primary-hovered',
              _disabled: {
                borderColor: 'checkbox-border-disabled',
                bg: 'action-primary-disabled',
              },
            },
          }}
          _disabled={{
            value,
            opacity: 1,
            bg: isChecked ? 'interactive-disabled' : 'action-primary-disabled',
            borderColor: isChecked
              ? 'interactive-disabled'
              : 'checkbox-border-disabled',
          }}
          _pressed={{
            value,
            bg: 'action-primary-pressed',
          }}
          {...checkBoxProps}
        >
          {children}
        </BaseCheckBox>
      </Box>
      {!children && (
        <Pressable
          flex={1}
          display="flex"
          flexDirection="column"
          onPress={() => {
            if (onChangeCallback) {
              onChangeCallback(!isChecked);
            }
          }}
        >
          <Typography.Body2Strong selectable={false} color={titleColor}>
            {title}
          </Typography.Body2Strong>
          {!!description && (
            <Typography.Body2 selectable={false} color={descriptionColor}>
              {description}
            </Typography.Body2>
          )}
        </Pressable>
      )}
    </Box>
  );
};

CheckBox.defaultProps = defaultProps;
export default CheckBox;
