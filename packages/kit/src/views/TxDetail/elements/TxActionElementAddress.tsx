import React, { ComponentProps, useEffect, useState } from 'react';

import { Divider, HStack, Icon, Text, VStack } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useClipboard } from '../../../hooks/useClipboard';
import { GoPlusSecurityItems } from '../../ManageTokens/components/GoPlusAlertItems';
import { useAddressSecurityInfo } from '../../ManageTokens/hooks';

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
    checkSecurity?: boolean;
    networkId?: string;
  } & ComponentProps<typeof Text>,
) {
  const {
    address,
    isShorten = true,
    isLabelShow = true,
    isCopy = true,
    checkSecurity = false,
    networkId,
    flex,
    ...others
  } = props;
  const shouldCheckSecurity = checkSecurity && networkId;
  const { loading, data: securityInfo } = useAddressSecurityInfo(
    networkId ?? '',
    shouldCheckSecurity ? address : '',
  );
  const { copyText } = useClipboard();
  const label = useAddressLabel({ address });
  let text = isShorten ? shortenAddress(address) : address;
  if (label && isLabelShow) {
    text = `${label}(${address.slice(-4)})`;
  }

  return (
    <VStack flex={flex}>
      <TxActionElementPressable
        onPress={
          isCopy
            ? () => {
                copyText(address);
              }
            : undefined
        }
        icon={
          isCopy ? <Icon name="Square2StackOutline" size={20} /> : undefined
        }
      >
        <HStack alignItems="center">
          {securityInfo?.length ? (
            <Icon
              name="ShieldExclamationMini"
              size={20}
              color="icon-critical"
            />
          ) : null}
          <Text
            ml={securityInfo?.length ? 1 : 0}
            isTruncated
            maxW="300px"
            {...others}
            color={securityInfo?.length ? 'text-critical' : 'text-default'}
          >
            {text}
          </Text>
        </HStack>
      </TxActionElementPressable>
      {shouldCheckSecurity && !loading && securityInfo?.length ? (
        <VStack mt="2">
          <GoPlusSecurityItems items={securityInfo ?? []} />
          <Divider mt="2" />
        </VStack>
      ) : null}
    </VStack>
  );
}

export function TxActionElementAddressNormal(
  props: ComponentProps<typeof TxActionElementAddress>,
) {
  return <TxActionElementAddress typography="Body2Strong" {...props} />;
}

export function getTxActionElementAddressWithSecurityInfo({
  address,
  networkId,
  withSecurityInfo = false,
  typography = 'Body2Strong',
}: {
  address: string;
  withSecurityInfo: boolean;
  networkId?: string;
  typography?: ComponentProps<typeof Text>['typography'];
}) {
  if (withSecurityInfo && networkId) {
    return (
      <TxActionElementAddress
        checkSecurity
        address={address}
        networkId={networkId}
        typography={typography}
      />
    );
  }
  return <TxActionElementAddress typography={typography} address={address} />;
}
