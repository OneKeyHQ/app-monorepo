import React, { ComponentProps, FC } from 'react';

import { Checkbox as BaseCheckBox, IBoxProps } from 'native-base';

import Box from '../Box';
import Pressable from '../Pressable';
import Typography from '../Typography';

import { getCheckBoxIcon } from './CheckBoxIcon';

export type CheckBoxProps = {
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
  value?: string;
  /**
   * 选择说明详细内容
   */
  describe?: string;
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
  onChange?: () => void;
} & ComponentProps<typeof Box>;

const defaultProps = {
  isChecked: false,
  focusable: false,
  isDisabled: false,
  hasDefault: false,
} as const;

const CheckBox: FC<CheckBoxProps> = ({
  isChecked,
  value,
  describe,
  defaultIsChecked,
  focusable,
  isDisabled,
  onChange,
  ...props
}) => {
  let titleColor = 'text-default';
  let describeColor = 'text-subdued';

  if (isDisabled) {
    titleColor = 'text-disabled';
    describeColor = 'text-disabled';
  }
  const { ...boxPorps } = props as IBoxProps;

  return (
    <Box
      {...boxPorps}
      display="flex"
      flexDirection="row"
      alignItems="flex-start"
    >
      <Box h="5" mr="3" justifyContent="flex-end" display="flex">
        <BaseCheckBox
          value=""
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          onChange={(state) => {
            if (onChange && !isDisabled) onChange();
          }}
          icon={getCheckBoxIcon(isDisabled ?? false, defaultIsChecked ?? false)}
          defaultIsChecked={defaultIsChecked}
          isChecked={isChecked}
          focusable={focusable}
          isDisabled={isDisabled}
          borderRadius="md"
          borderColor="border-default"
          _hover={{
            value: '',
            bg: 'action-primary-hovered',
            borderColor: 'border-hovered',
            _interactionBox: {
              value: '',
              bg: 'action-secondary-hovered',
            },
          }}
          _checked={{
            value: '',
            bg: 'action-primary-default',
            borderColor: 'action-primary-default',
          }}
          _disabled={{
            value: '',
            opacity: 1,
            bg: isChecked
              ? 'action-primary-activate-disabled'
              : 'action-primary-disabled',
            borderColor: isChecked
              ? 'action-primary-activate-disabled'
              : 'checkbox-border-disabled',
          }}
          _pressed={{
            value: '',
            bg: 'action-primary-pressed',
          }}
        />
      </Box>
      <Pressable
        flex={1}
        display="flex"
        flexDirection="column"
        onPress={() => {
          if (onChange && !isDisabled) onChange();
        }}
      >
        <Typography.Body2
          selectable={false}
          fontWeight="bold"
          color={titleColor}
        >
          {value}
        </Typography.Body2>
        {!!describe && (
          <Typography.Body2 selectable={false} color={describeColor}>
            {describe}
          </Typography.Body2>
        )}
      </Pressable>
    </Box>
  );
};

CheckBox.defaultProps = defaultProps;
export default CheckBox;
