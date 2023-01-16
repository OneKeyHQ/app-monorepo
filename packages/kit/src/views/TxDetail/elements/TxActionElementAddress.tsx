import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Center,
  Divider,
  HStack,
  Icon,
  Text,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useClipboard } from '../../../hooks/useClipboard';
import { showOverlay } from '../../../utils/overlayUtils';
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
  const intl = useIntl();
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

  const showScamAlert = useCallback(
    (addressToCopy: string) => {
      showOverlay((close) => (
        <BottomSheetModal title="" closeOverlay={close} showCloseButton={false}>
          <Center mt={-10}>
            <Icon name="DialogIconTypeDangerMini" size={48} />
          </Center>
          <Box>
            <Text
              textAlign="center"
              typography="DisplayMedium"
              fontSize={20}
              mt={5}
            >
              {intl.formatMessage({
                id: 'title__beware_of_address_poisoning_scams',
              })}
            </Text>
            <Text
              textAlign="center"
              typography="Body2"
              color="text-subdued"
              mt={2}
              fontSize={14}
            >
              {intl.formatMessage({
                id: 'title__beware_of_address_poisoning_scams_desc',
              })}
            </Text>
            <Text
              textAlign="center"
              typography="Body2"
              color="text-subdued"
              mt={5}
              fontSize={14}
            >
              {addressToCopy}
            </Text>
          </Box>
          <HStack space={3} mt={6} pb={5}>
            <Button size="xl" flex={1} onPress={() => close()}>
              {intl.formatMessage({ id: 'action__cancel' })}
            </Button>
            <Button
              flex={1}
              size="xl"
              type="destructive"
              onPress={() => {
                copyText(addressToCopy);
                close();
              }}
            >
              {intl.formatMessage({ id: 'action__copy_address' })}
            </Button>
          </HStack>
        </BottomSheetModal>
      ));
    },
    [copyText, intl],
  );

  const handleCopyText = useCallback(
    (addressToCopy: string) => {
      if (amount === '0') {
        showScamAlert(address);
      } else {
        copyText(addressToCopy);
      }
    },
    [address, amount, copyText, showScamAlert],
  );

  return (
    <VStack flex={flex}>
      <TxActionElementPressable
        onPress={
          isCopy
            ? () => {
                handleCopyText(address);
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
  amount,
}: {
  address: string;
  withSecurityInfo: boolean;
  amount?: string;
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
        amount={amount}
      />
    );
  }
  return (
    <TxActionElementAddress
      typography={typography}
      address={address}
      amount={amount}
    />
  );
}
