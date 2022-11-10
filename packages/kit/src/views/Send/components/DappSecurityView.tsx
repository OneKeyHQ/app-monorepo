import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { Box, HStack, Icon, Typography, VStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const DappSecurityView: FC<{ hostname: string; origin: string }> = ({
  hostname,
  origin,
}) => {
  const [securityItems, setSecurityItems] = useState<string[] | undefined>();

  const fetchSecurityInfo = useCallback(() => {
    backgroundApiProxy.serviceToken
      .getSiteSecurityInfo(origin)
      .then((res) => setSecurityItems(res));
  }, [origin]);

  useEffect(() => {
    fetchSecurityInfo();
  }, [fetchSecurityInfo]);

  const dappIcon = useMemo(() => {
    if (typeof securityItems === 'undefined') {
      return <Icon name="QuestionMarkCircleSolid" size={32} />;
    }
    if (securityItems?.length === 0) {
      return <Icon name="BadgeCheckSolid" size={32} color="icon-success" />;
    }
    return (
      <Icon name="ShieldExclamationSolid" size={32} color="icon-critical" />
    );
  }, [securityItems]);

  return (
    <>
      <HStack
        pb="4"
        borderBottomWidth="1px"
        borderBottomColor="divider"
        alignItems="center"
        mt="-2"
      >
        {dappIcon}
        <VStack ml="3">
          <Typography.Body1Strong>
            {hostname?.split('.')?.reverse?.()?.[1] ?? 'N/A'}
          </Typography.Body1Strong>
          <Typography.Body2>{hostname}</Typography.Body2>
        </VStack>
      </HStack>
      <HStack alignItems="center" flexWrap="wrap" pt="4">
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
              {item}
            </Typography.Body2Strong>
          </Box>
        ))}
      </HStack>
    </>
  );
};
