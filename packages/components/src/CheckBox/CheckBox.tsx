import React, { ComponentProps, FC, useMemo } from 'react';

import { Checkbox as BaseCheckBox, IBoxProps } from 'native-base';

import Box from '../Box';
import Pressable from '../Pressable';
import Typography from '../Typography';

import { getCheckBoxIcon } from './CheckBoxIcon';

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
      <Box h="5" mr="3" justifyContent="flex-end" display="flex">
        <BaseCheckBox
          value={value}
          name={name}
          onChange={onChangeCallback}
          icon={getCheckBoxIcon(isDisabled ?? false, defaultIsChecked ?? false)}
          defaultIsChecked={defaultIsChecked}
          isChecked={isChecked}
          focusable={focusable}
          isDisabled={isDisabled}
          accessibilityLabel={title}
          borderRadius="md"
          borderColor="border-default"
          _text={{
            color: 'text-default',
            fontWeight: 'bold',
            selectable: false,
            fontFamily: 'PlusJakartaSans-Medium',
            fontSize: 16,
            lineHeight: 24,
          }}
          _hover={{
            value,
            borderColor: isChecked
              ? 'action-primary-default'
              : 'border-hovered',
            _interactionBox: {
              value: '',
              bg: 'surface-hovered',
            },
          }}
          // @ts-ignore
          _focus={{
            _interactionBox: {
              value: '',
              bg: 'action-primary-focus',
            },
          }}
          // @ts-ignore
          _focusVisible={{
            _interactionBox: {
              bg: 'action-primary-focus',
            },
          }}
          _checked={{
            value,
            bg: 'action-primary-default',
            borderColor: 'action-primary-default',
          }}
          _disabled={{
            value,
            opacity: 1,
            bg: isChecked
              ? 'action-primary-activate-disabled'
              : 'action-primary-disabled',
            borderColor: isChecked
              ? 'action-primary-activate-disabled'
              : 'checkbox-border-disabled',
          }}
          _pressed={{
            value,
            bg: 'action-primary-pressed',
          }}
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
          <Typography.Body2
            fontWeight="bold"
            selectable={false}
            color={titleColor}
          >
            {title}
          </Typography.Body2>
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
