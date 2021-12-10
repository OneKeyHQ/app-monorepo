import React, { FC, ComponentProps } from 'react';

import Typography from '../Typography';
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
} & ComponentProps<typeof Typography.DisplaySmall>;

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

  return (
    <Typography.DisplaySmall {...rest}>{textContent}</Typography.DisplaySmall>
  );
};

Address.displayName = 'Address';
Address.defaultProps = defaultProps;

export default Address;
