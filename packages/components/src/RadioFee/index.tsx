import React, { FC } from 'react';

import Box from '../Box';
import RadioBox from '../RadioBox';
import { RadioBoxProps } from '../RadioBox/RadioBox';
import { RadioBoxGroupProps } from '../RadioBox/RadioBoxGroup';
import Typography from '../Typography';

export type RadioFeeItemProps = {
  value: string;
  title: string;
  titleSecond: string;
  describe: string;
  describeSecond: string;
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
        >
          <Box alignItems="flex-start">
            <Typography.Body1
              color={item.isDisabled ? 'text-disabled' : 'text-default'}
            >
              {item.title}
            </Typography.Body1>
            <Typography.Body2
              color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
            >
              {item.titleSecond}
            </Typography.Body2>
          </Box>
          <Box alignItems="flex-end">
            <Typography.Body1
              color={item.isDisabled ? 'text-disabled' : 'text-default'}
            >
              {item.describe}
            </Typography.Body1>
            <Typography.Body2
              color={item.isDisabled ? 'text-disabled' : 'text-subdued'}
            >
              {item.describeSecond}
            </Typography.Body2>
          </Box>
        </RadioBox>,
      );
    });
    return itemComponents;
  };

  return <RadioBox.Group {...props}>{readItemComponents()}</RadioBox.Group>;
};

export default RadioFee;
