import type { ComponentProps, FC } from 'react';

import { Radio as BaseRadio } from 'native-base';

import Box from '../Box';
import Pressable from '../Pressable';
import Text from '../Text';
import Typography from '../Typography';

import type { IBoxProps, IRadioProps } from 'native-base';

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
  description?: string;
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
  description,
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

  const { ...radioProps } = props as IRadioProps;
  const { ...boxProps } = props as IBoxProps;

  return (
    <Box
      {...boxProps}
      display="flex"
      flexDirection="row"
      alignItems="flex-start"
    >
      <Box h="5" mr="3" justifyContent="flex-end" display="flex">
        <BaseRadio
          {...radioProps}
          size="md"
          accessibilityLabel={radioProps.value}
          focusable={focusable}
          isDisabled={isDisabled}
          borderRadius="full"
          borderColor="border-default"
          bg="surface-default"
          _hover={{
            _interactionBox: {
              bg: 'surface-hovered',
            },
          }}
          _icon={{
            color: isDisabled ? 'surface-subdued' : 'surface-default',
          }}
          _checked={{
            borderColor: 'action-primary-default',
            bg: 'action-primary-default',
          }}
          _focus={{
            _interactionBox: {
              bg: 'action-primary-focus',
            },
          }}
          // @ts-expect-error
          _focusVisible={{
            _interactionBox: {
              bg: 'action-primary-focus',
            },
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
              bg: 'action-primary-focus',
            },
          }}
        />
      </Box>
      {!!(description || title) && (
        <Pressable display="flex" flex={1}>
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            selectable={false}
            color={titleColor}
            h="5"
          >
            {title}
          </Text>
          {!!description && (
            <Typography.Body2Strong selectable={false} color={describeColor}>
              {description}
            </Typography.Body2Strong>
          )}
        </Pressable>
      )}
    </Box>
  );
};

Radio.defaultProps = defaultProps;
export default Radio;
