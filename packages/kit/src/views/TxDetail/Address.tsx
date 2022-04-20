import React, { FC, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';

export type AddressProps = {
  address: string;
  isFromAddress: boolean; // otherwise toAddress
  label?: string;
};

const getItemParams = (
  { address, isFromAddress, label }: AddressProps,
  intl: IntlShape,
) => {
  const titleId = isFromAddress ? 'content__from' : 'content__to';
  const title = intl.formatMessage({ id: titleId });
  if (label !== undefined) {
    return { title, describe: address, subDescribe: label };
  }

  // TODO: get account name from db
  return { title, describe: address };
};

const Address: FC<AddressProps> = (addressProps) => {
  const intl = useIntl();
  const itemParams = useMemo(
    () => getItemParams(addressProps, intl),
    [addressProps, intl],
  );
  return <Container.Item {...itemParams} />;
};

export default Address;
