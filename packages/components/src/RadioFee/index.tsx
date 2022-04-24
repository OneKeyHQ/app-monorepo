import React, { FC } from 'react';

import Box from '../Box';
import RadioBox from '../RadioBox';
import { RadioBoxProps } from '../RadioBox/RadioBox';
import { RadioBoxGroupProps } from '../RadioBox/RadioBoxGroup';
import Typography, { Text } from '../Typography';

export type RadioFeeItemProps = {
  value: string;
  title: string | React.ReactElement<any>;
  titleSecond: string | React.ReactElement<any>;
  describe: string | React.ReactElement<any>;
  describeSecond: string | React.ReactElement<any>;
  describeThird?: string | React.ReactElement<any>;
} & RadioBoxProps;

export type RadioFeeProps = {
  items: RadioFeeItemProps[];
} & RadioBoxGroupProps;

const RadioFee: FC<RadioFeeProps> = ({ items, ...props }) => {
  const readItemComponents = () => {
    const itemComponents: React.ReactElement<RadioBoxProps>[] = [];
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
            <Typography.Body2
              mt="auto"
              color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
            >
              {item.titleSecond}
            </Typography.Body2>
          </Box>
          <Box alignItems="flex-end">
            <Text
              typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
              color={item.isDisabled ? 'text-disabled' : 'text-default'}
            >
              {item.describe}
            </Text>
            <Typography.Body2
              color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
            >
              {item.describeSecond}
            </Typography.Body2>
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
