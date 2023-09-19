import type { FC, ReactElement } from 'react';

import RadioBox from '../RadioBox';
import Text from '../Text';

import type { RadioBoxProps } from '../RadioBox/RadioBox';
import type { RadioBoxGroupProps } from '../RadioBox/RadioBoxGroup';

export type RadioFeeItemProps = {
  value: string;
  title: string | ReactElement<any>;
  describe?: string | ReactElement<any>;
} & RadioBoxProps;

export type RadioFeeProps = {
  items: RadioFeeItemProps[];
} & RadioBoxGroupProps;

const RadioFee: FC<RadioFeeProps> = ({ items, ...props }) => {
  const readItemComponents = () => {
    const itemComponents: ReactElement<RadioBoxProps>[] = [];
    items.forEach(({ isDisabled, value, title, describe, ...rest }) => {
      itemComponents.push(
        <RadioBox
          disabled={isDisabled}
          value={value}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mt={3}
          key={value}
          borderWidth={0}
          {...rest}
        >
          {typeof title === 'string' ? (
            <Text
              typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
              color={isDisabled ? 'text-disabled' : 'text-default'}
            >
              {title}
            </Text>
          ) : (
            title
          )}

          {!!describe && typeof describe === 'string' ? (
            <Text
              typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
              color={isDisabled ? 'text-disabled' : 'text-subdued'}
            >
              {describe}
            </Text>
          ) : (
            describe
          )}
        </RadioBox>,
      );
    });
    return itemComponents;
  };

  return <RadioBox.Group {...props}>{readItemComponents()}</RadioBox.Group>;
};

export default RadioFee;
