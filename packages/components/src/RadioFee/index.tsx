import type { FC, ReactElement } from 'react';

import Box from '../Box';
import RadioBox from '../RadioBox';
import Typography, { Text } from '../Typography';

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
    items.forEach((item) => {
      itemComponents.push(
        <RadioBox
          disabled={item.isDisabled}
          value={item.value}
          flexDirection="row"
          justifyContent="space-between"
          mt={3}
          key={item.value}
        >
          <Box alignSelf="stretch">
            <Text
              typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
              color={item.isDisabled ? 'text-disabled' : 'text-default'}
            >
              {item.title}
            </Text>
            {!!item.titleSecond && (
              <Typography.Body2
                mt="auto"
                color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
              >
                {item.titleSecond}
              </Typography.Body2>
            )}
          </Box>
          <Box alignItems="flex-end">
            {!!item.describe && (
              <Text
                typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
                color={item.isDisabled ? 'text-disabled' : 'text-default'}
              >
                {item.describe}
              </Text>
            )}
            {!!item.describeSecond && (
              <Typography.Body2
                color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
              >
                {item.describeSecond}
              </Typography.Body2>
            )}

            {!!item.describeThird && (
              <Typography.Body2
                color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
              >
                {item.describeThird}
              </Typography.Body2>
            )}
          </Box>
        </RadioBox>,
      );
    });
    return itemComponents;
  };

  return <RadioBox.Group {...props}>{readItemComponents()}</RadioBox.Group>;
};

export default RadioFee;
