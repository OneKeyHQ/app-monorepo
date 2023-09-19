import type { FC } from 'react';
import { useEffect, useState } from 'react';

import _ from 'lodash';
import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';
import type { ContentItemProps } from '@onekeyhq/components/src/Container/ContentBasisItem';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export type AddressProps = {
  address: string; // as title
  isFromAddress: boolean; // otherwise toAddress
  label?: string; // as subDescribe
} & Omit<ContentItemProps, 'title'>;

const Address: FC<AddressProps> = (addressProps) => {
  const { address, isFromAddress, label } = addressProps;

  const intl = useIntl();
  const titleId = isFromAddress ? 'content__from' : 'content__to';
  const title = intl.formatMessage({ id: titleId });

  const [addressLabel, setAddressLabel] = useState(label);

  useEffect(() => {
    if (addressLabel) {
      return;
    }
    async function getAddressLabel() {
      const wallets = await backgroundApiProxy.engine.getWallets({
        includeAllPassphraseWallet: true,
      });
      const accountids = _.flatten(wallets.map((w) => w.accounts));
      const accounts = await backgroundApiProxy.engine.getAccounts(accountids);
      const name = _.find(
        accounts,
        (a) => a.address.toLowerCase() === address.toLowerCase(),
      )?.name;
      setAddressLabel(name);
    }
    getAddressLabel();
  }, [address, addressLabel]);

  const describe = addressLabel ?? address;
  const subDescribe = addressLabel ? address : null;

  return (
    <Container.Item
      {...addressProps}
      title={title}
      describe={describe}
      subDescribe={subDescribe}
    />
  );
};

export default Address;
