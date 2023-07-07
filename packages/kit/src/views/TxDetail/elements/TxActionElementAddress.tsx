import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { HStack, IconButton, Text, VStack } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AddressLabel } from '../../../components/AddressLabel';
import { useNetwork } from '../../../hooks';
import { useClipboard } from '../../../hooks/useClipboard';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { useAddressSecurityInfo } from '../../ManageTokens/hooks';
import { showAddressPoisoningScamAlert } from '../../Overlay/AddressPoisoningScamAlert';
import BaseMenu from '../../Overlay/BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../../Overlay/BaseMenu';

interface AddressMoreMenuProps extends IMenu {
  address: string;
  networkId?: string;
  isCopy?: boolean;
  amount?: string;
}

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

function TxActionElementAddressMoreMenu(props: AddressMoreMenuProps) {
  const { networkId, address, amount, isCopy, ...rest } = props;
  const { network } = useNetwork({ networkId });
  const openBlockBrowser = useOpenBlockBrowser(network);
  const { copyText } = useClipboard();
  const handleCopyText = useCallback(
    (addressToCopy: string) => {
      if (amount === '0') {
        showAddressPoisoningScamAlert(address);
      } else {
        copyText(addressToCopy);
      }
    },
    [address, amount, copyText],
  );

  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      isCopy && {
        id: 'action__copy_address',
        onPress: () => handleCopyText(address),
      },
      openBlockBrowser.hasAvailable && {
        id: 'action__view_in_browser',
        onPress: () => openBlockBrowser.openAddressDetails(address),
      },
    ];
    return baseOptions.filter(Boolean);
  }, [address, handleCopyText, isCopy, openBlockBrowser]);

  if (options.length === 0) return null;

  return <BaseMenu options={options} {...rest} />;
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
    amount?: string;
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
    amount,
    ...others
  } = props;
  const shouldCheckSecurity = !!(checkSecurity && networkId);
  const { data: securityInfo } = useAddressSecurityInfo(
    networkId ?? '',
    shouldCheckSecurity ? address : '',
  );

  const label = useAddressLabel({ address });
  let text = isShorten ? shortenAddress(address) : address;
  if (label && isLabelShow) {
    text = `${label}(${address.slice(-4)})`;
  }

  return (
    <VStack flex={flex}>
      <HStack alignItems="flex-start" space={1}>
        <VStack space={1} flex={1}>
          <Text
            ml={securityInfo?.length ? 1 : 0}
            isTruncated
            numberOfLines={2}
            {...others}
            color={securityInfo?.length ? 'text-critical' : 'text-default'}
          >
            {text}
          </Text>
          <AddressLabel
            address={address}
            networkId={networkId}
            securityInfo={securityInfo}
            shouldCheckSecurity={shouldCheckSecurity}
          />
        </VStack>
        <TxActionElementAddressMoreMenu
          networkId={networkId}
          address={address}
          amount={amount}
          isCopy={isCopy}
        >
          <IconButton
            circle
            mt="-6px"
            type="plain"
            iconSize={18}
            name="EllipsisVerticalOutline"
          />
        </TxActionElementAddressMoreMenu>
      </HStack>
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
  amount,
  isCopy,
  isShorten,
}: {
  address: string;
  withSecurityInfo: boolean;
  amount?: string;
  networkId?: string;
  typography?: ComponentProps<typeof Text>['typography'];
  isCopy?: boolean;
  isShorten?: boolean;
}) {
  if (withSecurityInfo && networkId) {
    return (
      <TxActionElementAddress
        checkSecurity
        address={address}
        networkId={networkId}
        typography={typography}
        amount={amount}
        isCopy={isCopy}
        isShorten={isShorten}
      />
    );
  }
  return (
    <TxActionElementAddress
      typography={typography}
      address={address}
      networkId={networkId}
      amount={amount}
      isCopy={isCopy}
      isShorten={isShorten}
    />
  );
}
