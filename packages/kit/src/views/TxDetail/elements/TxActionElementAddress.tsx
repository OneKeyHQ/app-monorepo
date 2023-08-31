import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { HStack, IconButton, Text, VStack } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AddressLabel } from '../../../components/AddressLabel';
import { useNavigation, useNetwork } from '../../../hooks';
import { useClipboard } from '../../../hooks/useClipboard';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { navigationShortcuts } from '../../../routes/navigationShortcuts';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { setHomeTabName } from '../../../store/reducers/status';
import { AddressBookRoutes } from '../../AddressBook/routes';
import { useAddressSecurityInfo } from '../../ManageTokens/hooks';
import { showAddressPoisoningScamAlert } from '../../Overlay/AddressPoisoningScamAlert';
import BaseMenu from '../../Overlay/BaseMenu';
import { WalletHomeTabEnum } from '../../Wallet/type';

import type { Contact } from '../../../store/reducers/contacts';
import type { IBaseMenuOptions, IMenu } from '../../Overlay/BaseMenu';

interface AddressMoreMenuProps extends IMenu {
  address: string;
  networkId?: string;
  isCopy?: boolean;
  amount?: string;
  isAccount?: boolean;
  contact?: Contact;
}

export function useAddressLabel({
  address,
  networkId,
}: {
  address: string;
  networkId?: string;
}) {
  const [label, setLabel] = useState('');
  const [walletId, setWalletId] = useState('');
  const [isWatchAccount, setIsWatchAccount] = useState(false);
  useEffect(() => {
    (async () => {
      const result = await backgroundApiProxy.serviceAccount.getAddressLabel({
        address,
        networkId,
      });
      if (result && result.label) {
        setLabel(result.label);
        setWalletId(result.walletId);
        setIsWatchAccount(result.accountId.startsWith('watching--'));
      }
    })();
  }, [address, networkId]);
  return {
    label,
    walletId,
    isWatchAccount,
  };
}

export function useAddressBookItem({ address }: { address: string }) {
  const [addressBookItem, setAddressBookItem] = useState<Contact>();
  useEffect(() => {
    (async () => {
      const contract = await backgroundApiProxy.serviceAddressbook.getItem({
        address,
      });
      if (contract) {
        setAddressBookItem(contract);
      }
    })();
  }, [address]);
  return addressBookItem;
}

function TxActionElementAddressMoreMenu(props: AddressMoreMenuProps) {
  const { networkId, address, amount, isCopy, isAccount, contact, ...rest } =
    props;
  const { network } = useNetwork({ networkId });
  const openBlockBrowser = useOpenBlockBrowser(network);
  const { copyText } = useClipboard();
  const navigation = useNavigation();
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

  const onOpenAccount = useCallback(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccountByAddress(
      {
        address,
        networkId,
      },
    );
    if (account && networkId) {
      await backgroundApiProxy.serviceAccount.changeCurrrentAccount({
        accountId: account.id,
        networkId,
      });
    }
    backgroundApiProxy.dispatch(setHomeTabName(WalletHomeTabEnum.Tokens));
    navigationShortcuts.navigateToHome();
  }, [networkId, address]);

  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      isCopy && {
        id: 'action__copy_address',
        onPress: () => handleCopyText(address),
        icon: 'Square2StackMini',
      },
      isAccount && {
        id: 'action__view_account',
        onPress: onOpenAccount,
        icon: 'UserCircleSolid',
      },
      !!contact && {
        id: 'action__edit',
        onPress: () => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.AddressBook,
            params: {
              screen: AddressBookRoutes.EditAddressRoute,
              params: {
                uuid: contact.id,
                defaultValues: {
                  name: contact.name,
                  address: contact.address,
                  networkId: contact.networkId,
                },
              },
            },
          });
        },
        icon: 'PencilSquareMini',
      },
      openBlockBrowser.hasAvailable && {
        id: 'action__view_in_browser',
        onPress: () => openBlockBrowser.openAddressDetails(address),
        icon: 'GlobeAltMini',
      },
    ];
    return baseOptions.filter(Boolean);
  }, [
    onOpenAccount,
    address,
    handleCopyText,
    isAccount,
    contact,
    isCopy,
    navigation,
    openBlockBrowser,
  ]);

  if (options.length === 0) return null;

  return <BaseMenu options={options} {...rest} />;
}

export function TxActionElementAddress(
  props: {
    address: string;
    isShorten?: boolean;
    isCopy?: boolean;
    flex?: number;
    checkSecurity?: boolean;
    networkId?: string;
    amount?: string;
    displayAddress?: boolean;
  } & ComponentProps<typeof Text>,
) {
  const {
    address,
    isShorten = true,
    isCopy = true,
    checkSecurity = false,
    networkId,
    flex,
    amount,
    displayAddress = true,
    ...others
  } = props;
  const intl = useIntl();
  const shouldCheckSecurity = !!(checkSecurity && networkId);
  const { data: securityInfo } = useAddressSecurityInfo(
    networkId ?? '',
    shouldCheckSecurity ? address : '',
  );

  const {
    label,
    isWatchAccount,
    walletId: accountWalletId,
  } = useAddressLabel({ address, networkId });
  const contact = useAddressBookItem({ address });
  // const showAddress = !isLightningNetworkByNetworkId(networkId ?? '');
  let text = isShorten ? shortenAddress(address) : address;
  text =
    text === 'unknown' ? intl.formatMessage({ id: 'form__unknown' }) : text;

  return (
    <VStack flex={flex}>
      <HStack alignItems="flex-start" space={1}>
        <VStack space={1} flex={1}>
          {displayAddress && (
            <Text
              ml={securityInfo?.length ? 1 : 0}
              isTruncated
              numberOfLines={2}
              {...others}
              color={securityInfo?.length ? 'text-critical' : 'text-default'}
            >
              {text}
            </Text>
          )}
          <AddressLabel
            mt={-1}
            address={address}
            networkId={networkId}
            securityInfo={securityInfo}
            shouldCheckSecurity={shouldCheckSecurity}
            isAccount={!!label}
            accountLabel={label}
            walletId={accountWalletId}
            isWatchAccount={isWatchAccount}
            isAddressBook={!!contact}
            addressBookLabel={contact?.name}
            labelStyle={{ mt: 1 }}
          />
        </VStack>
        {address && address !== 'unknown' ? (
          <TxActionElementAddressMoreMenu
            networkId={networkId}
            address={address}
            amount={amount}
            isCopy={isCopy}
            isAccount={!!label}
            contact={contact}
          >
            <IconButton
              circle
              mt="-6px"
              type="plain"
              iconSize={18}
              name="EllipsisVerticalOutline"
            />
          </TxActionElementAddressMoreMenu>
        ) : null}
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
  displayAddress,
}: {
  address: string;
  withSecurityInfo: boolean;
  amount?: string;
  networkId?: string;
  typography?: ComponentProps<typeof Text>['typography'];
  isCopy?: boolean;
  isShorten?: boolean;
  displayAddress?: boolean;
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
        displayAddress={displayAddress}
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
      displayAddress={displayAddress}
    />
  );
}
