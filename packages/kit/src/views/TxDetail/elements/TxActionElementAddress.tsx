import React, { ComponentProps, useEffect, useState } from 'react';

import { Icon, Text } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useClipboard } from '../../../hooks/useClipboard';

import { TxActionElementPressable } from './TxActionElementPressable';

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
    flex?: number;
  } & ComponentProps<typeof Text>,
) {
  const {
    address,
    isShorten = true,
    isLabelShow = true,
    isCopy = true,
    flex,
    ...others
  } = props;
  const { copyText } = useClipboard();
  const label = useAddressLabel({ address });
  let text = isShorten ? shortenAddress(address) : address;
  if (label && isLabelShow) {
    text += ` (${label})`;
  }
  return (
    <TxActionElementPressable
      flex={flex}
      onPress={
        isCopy
          ? () => {
              copyText(address);
            }
          : undefined
      }
      icon={isCopy ? <Icon name="DuplicateSolid" size={20} /> : undefined}
    >
      <Text {...others}>{text}</Text>
    </TxActionElementPressable>
  );
}

export function TxActionElementAddressNormal(
  props: ComponentProps<typeof TxActionElementAddress>,
) {
  return <TxActionElementAddress typography="Body1Strong" {...props} />;
}
