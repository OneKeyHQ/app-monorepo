import type { FC, ReactElement } from 'react';

import Box from '../Box';
import RadioBox from '../RadioBox';
import Text from '../Text';
import Typography from '../Typography';

import type { RadioBoxProps } from '../RadioBox/RadioBox';
import type { RadioBoxGroupProps } from '../RadioBox/RadioBoxGroup';

export type RadioFeeItemProps = {
  value: string;
  title: string | ReactElement<any>;
  titleSecond?: string | ReactElement<any>;
  describe?: string | ReactElement<any>;
  describeSecond?: string | ReactElement<any>;
  describeThird?: string | ReactElement<any>;
} & RadioBoxProps;

export type RadioFeeProps = {
  items: RadioFeeItemProps[];
} & RadioBoxGroupProps;

const RadioFee: FC<RadioFeeProps> = ({ items, ...props }) => {
  const readItemComponents = () => {
    const itemComponents: ReactElement<RadioBoxProps>[] = [];
    items.forEach(
      ({
        isDisabled,
        value,
        title,
        titleSecond,
        describe,
        describeSecond,
        describeThird,
        ...rest
      }) => {
        itemComponents.push(
          <RadioBox
            disabled={isDisabled}
            value={value}
            flexDirection="row"
            justifyContent="space-between"
            mt={3}
            key={value}
            {...rest}
          >
            <Box alignSelf="stretch">
              <Text
                typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
                color={isDisabled ? 'text-disabled' : 'text-default'}
              >
                {title}
              </Text>
              {!!titleSecond && (
                <Typography.Body2
                  mt="auto"
                  color={isDisabled ? 'text-disabled' : 'text-subdued'}
                >
                  {titleSecond}
                </Typography.Body2>
              )}
            </Box>
            <Box alignItems="flex-end">
              {!!describe && (
                <Text
                  typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
                  color={isDisabled ? 'text-disabled' : 'text-default'}
                >
                  {describe}
                </Text>
              )}
              {!!describeSecond && (
                <Typography.Body2
                  display="flex"
                  alignItems="center"
                  color={isDisabled ? 'text-disabled' : 'text-subdued'}
                >
                  {describeSecond}
                </Typography.Body2>
              )}

              {!!describeThird && (
                <Typography.Body2
                  color={isDisabled ? 'text-disabled' : 'text-subdued'}
                >
                  {describeThird}
                </Typography.Body2>
              )}
            </Box>
          </RadioBox>,
        );
      },
    );
    return itemComponents;
  };

  return <RadioBox.Group {...props}>{readItemComponents()}</RadioBox.Group>;
};

export default RadioFee;
