import { useEffect, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Badge, HStack } from '@onekeyhq/components';
import type { BadgeType } from '@onekeyhq/components/src/Badge';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  GoPlusSupportApis,
  type GoPlusAddressSecurity,
} from '@onekeyhq/engine/src/types/goplus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { MessageDescriptor } from 'react-intl';

interface Props {
  address: string;
  networkId: string | undefined;
  showValidateLabel?: boolean;
  isAccount?: boolean;
  isAddressBook?: boolean;
  isContractAddress?: boolean;
  securityInfo?: (keyof GoPlusAddressSecurity)[];
  shouldCheckSecurity?: boolean;
}

interface Label {
  title: MessageDescriptor['id'];
  type: BadgeType;
  icon?: string;
}

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
    showValidateLabel = false,
  } = props;

  const intl = useIntl();

  const [isAccountLabel, setIsAccountLabel] = useState(false);
  const [isAddressBookLabel, setIsAddressBookLabel] = useState(false);
  const [isContractAddressLabel, setIsContractAddressLabel] = useState(false);
  const [securityLabels, setSecurityLabels] = useState<Label[]>([]);

  useEffect(() => {
    if (!isNil(isAccount)) {
      setIsAccountLabel(isAccount);
    } else {
      backgroundApiProxy.serviceAccount
        .getAddressLabel({
          address,
        })
        .then((resp) => setIsAccountLabel(!!resp.label));
    }

    if (!isNil(isAddressBook)) {
      setIsAddressBookLabel(isAddressBook);
    } else {
      backgroundApiProxy.serviceAddressbook
        .getItem({
          address,
        })
        .then((resp) => setIsAddressBookLabel(!!resp));
    }

    if (!isNil(isContractAddress)) {
      setIsContractAddressLabel(isContractAddress);
    } else if (networkId) {
      backgroundApiProxy.validator
        .isContractAddress(networkId, address)
        .then((resp) => setIsContractAddressLabel(resp));
    }
  }, [address, isAccount, isAddressBook, isContractAddress, networkId]);

  useEffect(() => {
    if (!shouldCheckSecurity) return;
    if (securityInfo && securityInfo.length > 0) {
      setSecurityLabels(
        securityInfo.map((info) => ({
          title: securityLocaleMaps[info],
          type: 'critical',
        })) as Label[],
      );
    }

    if (isNil(securityInfo) && networkId && address) {
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
        );
    }
  }, [address, networkId, securityInfo, shouldCheckSecurity]);

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

  if (securityLabels.length === 0 && addressLabels.length === 0) return null;

  return (
    <HStack space={1}>
      {[...addressLabels, ...securityLabels].map((label) => (
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
          key={label.title}
        />
      ))}
    </HStack>
  );
}

export { AddressLabel };
