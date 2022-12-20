import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Icon, Typography, VStack } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type {
  GoPlusDappContract,
  GoPlusPhishing,
} from '@onekeyhq/engine/src/types/goplus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// @ts-ignore
const localeMaps: Record<
  keyof GoPlusDappContract | keyof GoPlusPhishing,
  LocaleIds
> = {
  is_open_source: 'badge__not_open_source',
  malicious_contract: 'badge__malicious_contract',
  malicious_creator: 'badge__malicious_contract_creator',
  phishing_site: 'badge__phishing_site',
};

export const DappSecurityView: FC<{
  hostname: string;
  origin: string;
  networkId: string;
}> = ({ hostname, origin, networkId }) => {
  const intl = useIntl();
  const [securityItems, setSecurityItems] = useState<
    (keyof GoPlusDappContract | keyof GoPlusPhishing)[] | undefined
  >();

  const fetchSecurityInfo = useCallback(() => {
    backgroundApiProxy.serviceToken
      .getSiteSecurityInfo(origin, networkId)
      .then((res) => setSecurityItems(res));
  }, [origin, networkId]);

  useEffect(() => {
    fetchSecurityInfo();
  }, [fetchSecurityInfo]);

  const dappIcon = useMemo(() => {
    if (typeof securityItems === 'undefined') {
      return <Icon name="QuestionMarkCircleMini" size={32} />;
    }
    if (securityItems?.length === 0) {
      return <Icon name="BadgeCheckMini" size={32} color="icon-success" />;
    }
    return (
      <Icon name="ShieldExclamationMini" size={32} color="icon-critical" />
    );
  }, [securityItems]);

  return (
    <>
      <HStack alignItems="center" mt="-2" w="full">
        {dappIcon}
        <VStack ml="3" flex="1">
          <Typography.Body1Strong textTransform="capitalize">
            {hostname?.split('.')?.reverse?.()?.[1] ?? 'N/A'}
          </Typography.Body1Strong>
          <Typography.Body2 isTruncated maxW="300px">
            {hostname}
          </Typography.Body2>
        </VStack>
      </HStack>
      {securityItems && securityItems?.length > 0 ? (
        <HStack
          borderTopWidth="1px"
          borderTopColor="divider"
          alignItems="center"
          flexWrap="wrap"
          pt="4"
        >
          {securityItems?.map((item) => (
            <Box
              bg="surface-critical-subdued"
              py="2px"
              px="2"
              mr="2"
              mb="2"
              borderRadius="6px"
            >
              <Typography.Body2Strong color="text-critical">
                {intl.formatMessage({ id: localeMaps[item] ?? '' })}
              </Typography.Body2Strong>
            </Box>
          ))}
        </HStack>
      ) : null}
    </>
  );
};
