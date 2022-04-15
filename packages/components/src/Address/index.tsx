import React, { ComponentProps, FC } from 'react';

import { Text } from '../Typography';
import { shortenAddress } from '../utils';

export type AddressProps = {
  /**
   * 地址
   */
  text: string;
  /**
   * 是否缩写，默认为 false
   */
  short?: boolean;
} & ComponentProps<typeof Text>;

const defaultProps = {
  short: false,
} as const;

/**
 * Address 是一个适用于展示 区块链地址 的组件
 */
const Address: FC<AddressProps> = ({ text, short, ...rest }) => {
  let textContent = text;

  if (short) {
    textContent = shortenAddress(textContent);
  }

  return <Text {...rest}>{textContent}</Text>;
};

Address.displayName = 'Address';
Address.defaultProps = defaultProps;

export default Address;
