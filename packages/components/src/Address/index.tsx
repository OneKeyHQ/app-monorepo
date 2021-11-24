import React from 'react';
import { Text, ITextProps } from 'native-base';
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
} & ITextProps;

const defaultProps = {
  short: false,
} as const;

/**
 * Address 是一个适用于展示 区块链地址 的组件
 */
export const Address: React.FC<AddressProps> = ({ text, short }) => {
  let textContent = text;

  if (short) {
    textContent = shortenAddress(textContent);
  }
  // TODO: use Typography Component
  return <Text>{textContent}</Text>;
};

Address.displayName = 'Address';
Address.defaultProps = defaultProps;

export default Address;
