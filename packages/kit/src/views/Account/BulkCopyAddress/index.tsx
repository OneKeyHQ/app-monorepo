import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Modal,
  SegmentedControl,
  ToastManager,
  Token,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

import { useDebounce } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import { CreateAccountModalRoutes } from '../../../routes';

import SetRange from './SetRange';
import WalletAccounts from './WalletAccounts';

import type { CreateAccountRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { ISetRangeRefType, ISetRangeReturnType } from './SetRange';
import type {
  IWalletAccountsRefType,
  IWalletAccountsReturnType,
} from './WalletAccounts';
import type { RouteProp } from '@react-navigation/native';

export type IFetchAddressByRange = {
  type: 'setRange';
} & ISetRangeReturnType;

export type IFetchAddressByWallet = {
  type: 'walletAccounts';
} & IWalletAccountsReturnType;

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.BulkCopyAddresses
>;

const HeaderDescription: FC<{ network: Network }> = ({
  network,
}: {
  network: Network;
}) => (
  <Token
    size={4}
    showInfo
    showName
    showTokenVerifiedIcon={false}
    token={{
      name: network.name,
      logoURI: network.logoURI,
    }}
    nameProps={{
      typography: { sm: 'Caption', md: 'Caption' },
      color: 'text-subdued',
      ml: '-6px',
    }}
  />
);

const BulkCopyAddress: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId, networkId, password, entry, template } = route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { networks } = useRuntime();
  const network = networks.filter((n) => n.id === networkId)[0];

  const [selectedIndex, setSelectedIndex] = useState<number>(
    entry === 'accountSelector' ? 1 : 0,
  );

  const [setRangeDisabled, setSetRangeDisabled] = useState(false);
  const [walletAccountDisabled, setWalletAccountDisabled] = useState(false);

  const buttonDisabledInSetRange = useMemo(() => {
    if (selectedIndex === 1) return false;
    return setRangeDisabled;
  }, [selectedIndex, setRangeDisabled]);
  const debounceButtonDisabledInSetRange = useDebounce(
    buttonDisabledInSetRange,
    150,
  );

  const buttonDisabledInWalletAccount = useMemo(() => {
    if (selectedIndex === 0) return false;
    return walletAccountDisabled;
  }, [selectedIndex, walletAccountDisabled]);
  const debounceButtonDisabledInWalletAccount = useDebounce(
    buttonDisabledInWalletAccount,
    150,
  );

  const setRangeRef = useRef<ISetRangeRefType>(null);
  const walletAccountsRef = useRef<IWalletAccountsRefType>(null);
  const onPrimaryActionPress = useCallback(async () => {
    let data: IFetchAddressByRange | IFetchAddressByWallet;
    if (selectedIndex === 0) {
      const value = await setRangeRef.current?.onSubmit();
      if (!value) {
        return;
      }
      data = { ...value, type: 'setRange' } as IFetchAddressByRange;
    } else {
      const value = walletAccountsRef.current?.onSubmit();
      if (!value) {
        ToastManager.show(
          {
            title: intl.formatMessage({ id: 'empty__no_account_desc' }),
          },
          { type: 'default' },
        );
        return;
      }
      data = { ...value, type: 'walletAccounts' } as IFetchAddressByWallet;
    }

    navigation.navigate(CreateAccountModalRoutes.FetchAddressModal, {
      networkId,
      walletId,
      password,
      data,
    });
  }, [selectedIndex, navigation, networkId, walletId, password, intl]);

  return (
    <Modal
      height="488px"
      header={intl.formatMessage({ id: 'title__bulk_copy_addresses' })}
      headerDescription={<HeaderDescription network={network} />}
      hideSecondaryAction
      primaryActionTranslationId="action__export_addresses"
      onPrimaryActionPress={onPrimaryActionPress}
      primaryActionProps={{
        isDisabled:
          debounceButtonDisabledInSetRange ||
          debounceButtonDisabledInWalletAccount,
      }}
    >
      <Box mb={6}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'form__set_range' }),
            intl.formatMessage({ id: 'form__my_accounts' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>

      {selectedIndex === 0 && (
        <SetRange
          walletId={walletId}
          networkId={networkId}
          template={template}
          setButtonDisabled={setSetRangeDisabled}
          ref={setRangeRef}
        />
      )}
      {selectedIndex === 1 && (
        <WalletAccounts
          walletId={walletId}
          networkId={networkId}
          setButtonDisabled={setWalletAccountDisabled}
          ref={walletAccountsRef}
        />
      )}
    </Modal>
  );
};

export default BulkCopyAddress;
