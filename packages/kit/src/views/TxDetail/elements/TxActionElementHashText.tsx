// TODO TxActionElementHashText
import React, { ComponentProps, useEffect, useState } from 'react';

import { Icon, Text } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { TxActionElementWithIcon } from './TxActionElementPressable';

export function useAddressLabel({ address }: { address: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    (async () => {
      const result = await backgroundApiProxy.serviceAccount.getAddressLabel({
        address,
      });
      if (result && result.label) {
        setLabel(result.label);
      }
    })();
  }, [address]);
  return label;
}

export function TxActionElementAddress(
  props: {
    address: string;
    isShorten?: boolean;
    isLabelShow?: boolean;
    isCopy?: boolean;
  } & ComponentProps<typeof Text>,
) {
  const {
    address,
    isShorten = true,
    isLabelShow = true,
    isCopy = true,
    ...others
  } = props;
  const label = useAddressLabel({ address });
  let text = isShorten ? shortenAddress(address) : address;
  if (label && isLabelShow) {
    text += ` (${label})`;
  }
  // TODO copy button
  //    copyContentToClipboard()
  return (
    <TxActionElementWithIcon
      icon={isCopy ? <Icon name="DuplicateSolid" size={20} /> : undefined}
    >
      <Text {...others}>{text}</Text>
    </TxActionElementWithIcon>
  );
}

export function TxActionElementAddressNormal(
  props: ComponentProps<typeof TxActionElementAddress>,
) {
  return <TxActionElementAddress typography="Body1Strong" {...props} />;
}
