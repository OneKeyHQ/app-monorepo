import React, { FC } from 'react';

import Box from '../Box';
import RadioBox, { RadioBoxProps } from '../RadioBox';
import RadioBoxGroup, { RadioBoxGroupProps } from '../RadioBoxGroup';
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
  const itemComponents: React.ReactElement<RadioBoxProps>[] = [];
  items.forEach((item) => {
    itemComponents.push(
      <RadioBox
        value={item.value}
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box alignItems="flex-start">
          <Typography.Body1 color="text-default">{item.title}</Typography.Body1>
          <Typography.Body2 color="text-subdued">
            {item.titleSecond}
          </Typography.Body2>
        </Box>
        <Box alignItems="flex-end">
          <Typography.Body1 color="text-default">
            {item.describe}
          </Typography.Body1>
          <Typography.Body2 color="text-subdued">
            {item.describeSecond}
          </Typography.Body2>
        </Box>
      </RadioBox>,
    );
  });
  return <RadioBoxGroup {...props}>{itemComponents}</RadioBoxGroup>;
};

export default RadioFee;
