import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Badge, Box, HStack } from '@onekeyhq/components';
import type { BadgeType } from '@onekeyhq/components/src/Badge';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  type GoPlusAddressSecurity,
  GoPlusSupportApis,
} from '@onekeyhq/engine/src/types/goplus';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { MessageDescriptor } from 'react-intl';

type Props = {
  address: string;
  networkId: string | undefined;
  showValidAddressLabel?: boolean;
  isAccount?: boolean;
  isWatchAccount?: boolean;
  isAddressBook?: boolean;
  isValidAddress?: boolean;
  isContractAddress?: boolean;
  isInscribeAddress?: boolean;
  securityInfo?: (keyof GoPlusAddressSecurity)[];
  shouldCheckSecurity?: boolean;
  validAddressMessage?: MessageDescriptor['id'];
  validAddressMessageProperty?: Record<string, any>;
  labelStyle?: ComponentProps<typeof Box>;
  labelProps?: ComponentProps<typeof Badge>;
  isLoading?: boolean;
  accountLabel?: string;
  addressBookLabel?: string;
  walletId?: string;
} & ComponentProps<typeof HStack>;

type Label = {
  title: MessageDescriptor['id'];
  type: BadgeType;
  icon?: string;
  desc?: string;
};

// @ts-ignore
const securityLocaleMaps: Record<keyof GoPlusAddressSecurity, LocaleIds> = {
  'honeypot_related_address': 'badge__honeypot_related',
  'phishing_activities': 'badge__phishing',
  'blackmail_activities': 'badge__blackmail',
  'stealing_attack': 'badge__stealing_attack',
  'fake_kyc': 'badge__fake_kyc',
  'malicious_mining_activities': 'badge__malicious_mining',
  'darkweb_transactions': 'badge__darkweb_txns',
  'cybercrime': 'badge__cybercrime',
  'money_laundering': 'badge__money_laudering',
  'financial_crime': 'badge__financial_crime',
  'blacklist_doubt': 'badge__blacklist_doubt',
};

function AddressLabel(props: Props) {
  const {
    address,
    networkId,
    securityInfo,
    isAccount,
    isWatchAccount,
    accountLabel: accountLabelFromOut,
    addressBookLabel: addressBookLabelFromOut,
    walletId: WalletIdFromOut,
    isAddressBook,
    isContractAddress,
    isInscribeAddress,
    shouldCheckSecurity,
    isValidAddress,
    showValidAddressLabel = false,
    validAddressMessage,
    validAddressMessageProperty,
    labelStyle,
    labelProps,
    isLoading,
    ...rest
  } = props;

  const intl = useIntl();

  const [isAccountLabel, setIsAccountLabel] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | undefined>(
    accountLabelFromOut,
  );
  const [accountWallet, setAccountWallet] = useState<Wallet>();
  const [addressBookLabel, setAddressBookLabel] = useState<string | undefined>(
    addressBookLabelFromOut,
  );
  const [isLoadingAccountLabel, setIsLoadingAccountLabel] = useState(false);
  const [isAddressBookLabel, setIsAddressBookLabel] = useState(false);
  const [isLoadingAddressBookLabel, setIsLoadingAddressBookLabel] =
    useState(false);
  const [isWatchAccountLabel, setIsWatchAccountLabel] = useState(false);
  const [isContractAddressLabel, setIsContractAddressLabel] = useState(false);
  const [isLoadingContractAddressLabel, setIsLoadingContractAddressLabel] =
    useState(false);
  const [isValidAddressLabel, setIsValidAddressLabel] = useState(false);
  const [securityLabels, setSecurityLabels] = useState<Label[]>([]);
  const [isLoadingSecurityLabels, setIsLoadingSecurityLabels] = useState(false);

  useEffect(() => {
    if (!isNil(isAccount)) {
      setIsAccountLabel(isAccount);
      setAccountLabel(accountLabelFromOut);
      if (!isNil(isWatchAccount)) {
        setIsWatchAccountLabel(isWatchAccount);
      }
      if (WalletIdFromOut) {
        backgroundApiProxy.engine
          .getWallet(WalletIdFromOut)
          .then((wallet) => setAccountWallet(wallet));
      }
    } else {
      setIsLoadingAccountLabel(true);
      backgroundApiProxy.serviceAccount
        .getAddressLabel({
          address,
          networkId,
        })
        .then((resp) => {
          setIsAccountLabel(!!resp.label);
          setAccountLabel(resp.label);
          setIsWatchAccountLabel(resp.accountId.startsWith('watching--'));

          if (resp.walletId) {
            backgroundApiProxy.engine
              .getWallet(resp.walletId)
              .then((wallet) => setAccountWallet(wallet));
          }
        })
        .finally(() => setIsLoadingAccountLabel(false));
    }

    if (!isNil(isAddressBook)) {
      setIsAddressBookLabel(isAddressBook);
      setAddressBookLabel(addressBookLabelFromOut);
    } else {
      setIsLoadingAddressBookLabel(true);
      backgroundApiProxy.serviceAddressbook
        .getItem({
          address,
        })
        .then((resp) => {
          setIsAddressBookLabel(!!resp);
          setAddressBookLabel(resp?.name);
        })
        .finally(() => setIsLoadingAddressBookLabel(false));
    }

    if (!isNil(isContractAddress)) {
      setIsContractAddressLabel(isContractAddress);
    } else if (networkId) {
      setIsLoadingContractAddressLabel(true);
      backgroundApiProxy.validator
        .isContractAddress(networkId, address)
        .then((resp) => setIsContractAddressLabel(resp))
        .finally(() => setIsLoadingContractAddressLabel(false));
    }
  }, [
    WalletIdFromOut,
    accountLabelFromOut,
    address,
    addressBookLabelFromOut,
    isAccount,
    isAddressBook,
    isContractAddress,
    isWatchAccount,
    networkId,
  ]);

  useEffect(() => {
    if (!shouldCheckSecurity) return;
    if (!isNil(securityInfo)) {
      setSecurityLabels(
        securityInfo.map((info) => ({
          title: securityLocaleMaps[info],
          type: 'critical',
        })) as Label[],
      );
    } else if (isNil(securityInfo) && networkId && address) {
      setIsLoadingSecurityLabels(true);
      backgroundApiProxy.serviceToken
        .getAddressRiskyItems({
          address,
          networkId,
          apiName: GoPlusSupportApis.address_security,
        })
        .then((resp) =>
          setSecurityLabels(
            resp.map((info) => ({
              title: securityLocaleMaps[info],
              type: 'critical',
            })) as Label[],
          ),
        )
        .finally(() => setIsLoadingSecurityLabels(false));
    }
  }, [address, networkId, securityInfo, shouldCheckSecurity]);

  useEffect(() => {
    if (!showValidAddressLabel) return;
    if (!isNil(isValidAddress)) {
      setIsValidAddressLabel(isValidAddress);
    } else if (networkId) {
      backgroundApiProxy.validator
        .validateAddress(networkId, address)
        .then(() => {
          setIsValidAddressLabel(true);
        })
        .catch(() => setIsValidAddressLabel(false));
    }
  }, [address, isValidAddress, networkId, showValidAddressLabel]);

  const addressLabels = useMemo(() => {
    const labels = [
      isAccountLabel && {
        title:
          accountWallet?.name ??
          (isWatchAccountLabel ? 'form__watched_address' : 'form__my_account'),
        type: 'success',
        icon: accountWallet?.avatar?.emoji ?? '👤',
        desc: accountLabel,
      },
      isAddressBookLabel && {
        title: 'title__address_book',
        type: 'info',
        icon: '📖',
        desc: addressBookLabel,
      },
      isContractAddressLabel && {
        title: 'content__contract_address',
        type: 'warning',
        icon: '📝',
      },
      isInscribeAddress && {
        title: 'content__inscribe_address',
        type: 'warning',
        icon: '📝',
      },
    ];
    return labels.filter(Boolean) as Label[];
  }, [
    accountLabel,
    accountWallet?.avatar?.emoji,
    accountWallet?.name,
    addressBookLabel,
    isAccountLabel,
    isAddressBookLabel,
    isContractAddressLabel,
    isInscribeAddress,
    isWatchAccountLabel,
  ]);

  const validateLabels = useMemo(() => {
    const labels = [
      isValidAddressLabel &&
        !(
          isAccountLabel ||
          isAddressBookLabel ||
          isContractAddressLabel ||
          (securityInfo?.length ?? 0) > 0 ||
          isLoadingAccountLabel ||
          isLoadingAddressBookLabel ||
          isLoadingContractAddressLabel ||
          isLoadingSecurityLabels
        ) && {
          title: validAddressMessage || 'form__enter_recipient_address_valid',
          type: 'default',
          icon: '👌',
          description: validAddressMessageProperty,
        },
    ];
    return labels.filter(Boolean) as Label[];
  }, [
    isAccountLabel,
    isAddressBookLabel,
    isContractAddressLabel,
    isLoadingAccountLabel,
    isLoadingAddressBookLabel,
    isLoadingContractAddressLabel,
    isLoadingSecurityLabels,
    isValidAddressLabel,
    securityInfo?.length,
    validAddressMessage,
    validAddressMessageProperty,
  ]);

  const getTitle = useCallback(
    (label: Label) => {
      const values =
        validAddressMessageProperty &&
        typeof validAddressMessageProperty === 'object'
          ? validAddressMessageProperty
          : undefined;

      if (label.icon) {
        if (label.desc) {
          return `${label.icon} ${intl.formatMessage(
            {
              id: label.title,
            },
            values,
          )}: ${label.desc}`;
        }

        return `${label.icon} ${intl.formatMessage(
          {
            id: label.title,
          },
          values,
        )}`;
      }

      if (label.desc) {
        return `${intl.formatMessage(
          {
            id: label.title,
          },
          values,
        )}: ${label.desc}`;
      }

      return `${intl.formatMessage(
        {
          id: label.title,
        },
        values,
      )}`;
    },
    [intl, validAddressMessageProperty],
  );
  if (
    securityLabels.length === 0 &&
    addressLabels.length === 0 &&
    validateLabels.length === 0
  )
    return null;

  if (isLoading) return <Box height="28px" />;

  return (
    <HStack space={1} flexWrap="wrap" {...rest}>
      {[...validateLabels, ...addressLabels, ...securityLabels].map((label) => (
        <Box {...labelStyle} key={label.title}>
          <Badge
            size="sm"
            title={getTitle(label)}
            type={label.type}
            {...labelProps}
          />
        </Box>
      ))}
    </HStack>
  );
}

export { AddressLabel };
