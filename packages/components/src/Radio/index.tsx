import React, { ComponentProps, FC } from 'react';

import { Radio as BaseRadio, IBoxProps, IRadioProps } from 'native-base';

import Box from '../Box';
import Pressable from '../Pressable';
import Typography from '../Typography';

export type RadioProps = {
  /**
   * 是否选中
   */
  isChecked?: string;
  /**
   * 选择说明标题
   */
  title?: string;
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
} & ComponentProps<typeof BaseRadio>;

const defaultProps = {
  focusable: false,
  isDisabled: false,
  hasDefault: false,
} as const;

const Radio: FC<RadioProps> = ({
  isChecked,
  title,
  describe,
  focusable,
  isDisabled,
  ...props
}) => {
  let titleColor = 'text-default';
  let describeColor = 'text-subdued';

  if (isDisabled) {
    titleColor = 'text-disabled';
    describeColor = 'text-disabled';
  }

  const { ...radioPorps } = props as IRadioProps;
  const { ...boxPorps } = props as IBoxProps;

  return (
    <Box
      {...boxPorps}
      display="flex"
      flexDirection="row"
      alignItems="flex-start"
    >
      <Box h="5" mr="3" justifyContent="flex-end" display="flex">
        <BaseRadio
          {...radioPorps}
          size="md"
          focusable={focusable}
          isDisabled={isDisabled}
          borderRadius="full"
          borderColor="border-default"
          // @ts-ignore
          _hover={{
            bg: 'action-primary-hovered',
            borderColor: 'border-hovered',
            _interactionBox: {
              bg: 'action-primary-hovered',
            },
          }}
          _icon={{
            color: isDisabled ? 'surface-subdued' : 'surface-default',
          }}
          _checked={{
            borderColor: 'action-primary-default',
            bg: 'action-primary-default',
          }}
          _disabled={{
            opacity: 1,
            bg: isChecked
              ? 'action-primary-activate-disabled'
              : 'action-primary-disabled',
            borderColor: isChecked
              ? 'action-primary-activate-disabled'
              : 'checkbox-border-disabled',
          }}
          _pressed={{
            bg: 'action-primary-pressed',
            _interactionBox: {
              bg: 'action-secondary-hovered',
            },
          }}
        />
      </Box>
      {!!(describe || title) && (
        <Pressable display="flex" flex={1}>
          <Typography.Body2
            selectable={false}
            fontWeight="bold"
            color={titleColor}
            h="5"
          >
            {title}
          </Typography.Body2>
          {!!describe && (
            <Typography.Body2 selectable={false} color={describeColor}>
              {describe}
            </Typography.Body2>
          )}
        </Pressable>
      )}
    </Box>
  );
};

Radio.defaultProps = defaultProps;
export default Radio;
