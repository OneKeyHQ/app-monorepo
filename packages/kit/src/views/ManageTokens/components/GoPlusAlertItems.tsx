import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Typography } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { GoPlusAddressSecurity } from '@onekeyhq/engine/src/types/goplus';

// @ts-ignore
const localeMaps: Record<keyof GoPlusAddressSecurity, LocaleIds> = {
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

export const GoPlusSecurityItems: FC<{
  items: (keyof GoPlusAddressSecurity)[];
}> = ({ items }) => {
  const intl = useIntl();

  if (items.length === 0) return null;
  return (
    <HStack mt="2" w="full" flexWrap="wrap">
      {items.map((item) => (
        <Box
          bg="surface-critical-subdued"
          px="2"
          py="2px"
          mr="2"
          borderRadius="6px"
          mb="2"
        >
          <Typography.Body2Strong key={item} color="text-critical">
            {intl.formatMessage({ id: localeMaps[item] })}
          </Typography.Body2Strong>
        </Box>
      ))}
    </HStack>
  );
};
