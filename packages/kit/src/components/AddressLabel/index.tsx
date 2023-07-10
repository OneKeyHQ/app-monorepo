import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Badge, Box, HStack } from '@onekeyhq/components';
import type { BadgeType } from '@onekeyhq/components/src/Badge';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  type GoPlusAddressSecurity,
  GoPlusSupportApis,
} from '@onekeyhq/engine/src/types/goplus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { MessageDescriptor } from 'react-intl';

type Props = {
  address: string;
  networkId: string | undefined;
  showValidAddressLabel?: boolean;
  isAccount?: boolean;
  isAddressBook?: boolean;
  isValidAddress?: boolean;
  isContractAddress?: boolean;
  securityInfo?: (keyof GoPlusAddressSecurity)[];
  shouldCheckSecurity?: boolean;
  validAddressMessage?: MessageDescriptor['id'];
  labelStyle?: ComponentProps<typeof Box>;
  labelProps?: ComponentProps<typeof Badge>;
  isLoading?: boolean;
} & ComponentProps<typeof HStack>;

type Label = {
  title: MessageDescriptor['id'];
  type: BadgeType;
  icon?: string;
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
    isAddressBook,
    isContractAddress,
    shouldCheckSecurity,
    isValidAddress,
    showValidAddressLabel = false,
    validAddressMessage,
    labelStyle,
    labelProps,
    isLoading,
    ...rest
  } = props;

  const intl = useIntl();

  const [isAccountLabel, setIsAccountLabel] = useState(false);
  const [isLoadingAccountLabel, setIsLoadingAccountLabel] = useState(false);
  const [isAddressBookLabel, setIsAddressBookLabel] = useState(false);
  const [isLoadingAddressBookLabel, setIsLoadingAddressBookLabel] =
    useState(false);
  const [isContractAddressLabel, setIsContractAddressLabel] = useState(false);
  const [isLoadingContractAddressLabel, setIsLoadingContractAddressLabel] =
    useState(false);
  const [isValidAddressLabel, setIsValidAddressLabel] = useState(false);
  const [securityLabels, setSecurityLabels] = useState<Label[]>([]);
  const [isLoadingSecurityLabels, setIsLoadingSecurityLabels] = useState(false);

  useEffect(() => {
    if (!isNil(isAccount)) {
      setIsAccountLabel(isAccount);
    } else {
      setIsLoadingAccountLabel(true);
      backgroundApiProxy.serviceAccount
        .getAddressLabel({
          address,
        })
        .then((resp) => {
          console.log(resp);
          setIsAccountLabel(!!resp.label);
        })
        .finally(() => setIsLoadingAccountLabel(false));
    }

    if (!isNil(isAddressBook)) {
      setIsAddressBookLabel(isAddressBook);
    } else {
      setIsLoadingAddressBookLabel(true);
      backgroundApiProxy.serviceAddressbook
        .getItem({
          address,
        })
        .then((resp) => setIsAddressBookLabel(!!resp))
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
  }, [address, isAccount, isAddressBook, isContractAddress, networkId]);

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
        title: 'form__account',
        type: 'success',
        icon: '👤',
      },
      isAddressBookLabel && {
        title: 'title__address_book',
        type: 'info',
        icon: '📖',
      },
      isContractAddressLabel && {
        title: 'content__contract_address',
        type: 'warning',
      },
    ];
    return labels.filter(Boolean) as Label[];
  }, [isAccountLabel, isAddressBookLabel, isContractAddressLabel]);

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
  ]);

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
            size="lg"
            title={
              label.icon
                ? `${label.icon} ${intl.formatMessage({
                    id: label.title,
                  })}`
                : intl.formatMessage({
                    id: label.title,
                  })
            }
            type={label.type}
            {...labelProps}
          />
        </Box>
      ))}
    </HStack>
  );
}

export { AddressLabel };
