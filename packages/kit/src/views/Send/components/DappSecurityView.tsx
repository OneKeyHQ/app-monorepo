import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Pressable,
  RichTooltip,
  Text,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { DAppMetadata } from '@onekeyhq/engine/src/types/dapp';
import type {
  GoPlusDappContract,
  GoPlusPhishing,
} from '@onekeyhq/engine/src/types/goplus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { openUrlExternal } from '../../../utils/openUrl';

const GOPLUS_FEEDBACK_URL = 'https://feedback.gopluslabs.io/';

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
  const [metadata, setMetaData] = useState<DAppMetadata>();

  const fetchSecurityInfo = useCallback(() => {
    backgroundApiProxy.serviceToken
      .getSiteSecurityInfo(origin, networkId)
      .then((res) => setSecurityItems(res));
  }, [origin, networkId]);

  useEffect(() => {
    fetchSecurityInfo();
  }, [fetchSecurityInfo]);

  useEffect(() => {
    const getDAppMetadata = async () => {
      const resp = await backgroundApiProxy.serviceDapp.getDAppMetadata(origin);
      setMetaData(resp);
    };
    getDAppMetadata();
  }, [origin]);

  const GoplusFeedbackLink = useCallback(
    (text) => (
      <Text
        color="text-subdued"
        onPress={() => openUrlExternal(GOPLUS_FEEDBACK_URL)}
        fontSize="10px"
        typography="Body2Underline"
      >
        {text}
      </Text>
    ),
    [],
  );

  const letter = metadata?.name?.slice(0, 4);
  const fallbackElement = useMemo(
    () =>
      letter ? (
        <Center
          width="full"
          height="full"
          borderRadius="full"
          bg="background-selected"
          overflow="hidden"
        >
          <Text textAlign="center" color="text-default">
            {letter.toUpperCase()}
          </Text>
        </Center>
      ) : (
        <Center
          width="full"
          height="full"
          borderRadius="full"
          bg="background-selected"
        >
          <Icon name="GlobeAsiaAustraliaMini" color="icon-subdued" />
        </Center>
      ),
    [letter],
  );

  const dappIcon = useMemo(
    () =>
      metadata?.icon ? (
        <Image
          width="full"
          height="full"
          src={metadata.icon}
          key={metadata.icon}
          fallbackElement={fallbackElement}
          alt={metadata.icon}
          borderRadius="full"
        />
      ) : (
        fallbackElement
      ),
    [fallbackElement, metadata?.icon],
  );

  const dappStatus = useMemo(() => {
    if (typeof securityItems === 'undefined') {
      return (
        <Icon name="QuestionMarkCircleMini" size={20} color="icon-subdued" />
      );
    }

    return (
      <RichTooltip
        // eslint-disable-next-line react/no-unstable-nested-components
        trigger={({ ...props }) => (
          <Pressable {...props}>
            {securityItems.length === 0 ? (
              <Icon name="BadgeCheckMini" size={20} color="icon-success" />
            ) : (
              <Icon
                name="ShieldExclamationMini"
                size={20}
                color="icon-critical"
              />
            )}
          </Pressable>
        )}
        bodyProps={{
          children: (
            <>
              {securityItems.length === 0 ? (
                <Text typography="Caption" fontSize="14px" mb={1}>
                  {intl.formatMessage({ id: 'title__verified_site' })}
                </Text>
              ) : null}
              <HStack space={1} alignItems="center">
                <Text color="text-subdued" fontSize="10px">
                  {intl.formatMessage(
                    { id: 'content__provided_by_str' },
                    { source: 'GoPlus' },
                  )}
                  .
                </Text>
                {GoplusFeedbackLink(
                  intl.formatMessage({ id: 'action__report' }),
                )}
              </HStack>
            </>
          ),
        }}
      />
    );
  }, [GoplusFeedbackLink, intl, securityItems]);

  return (
    <>
      <HStack alignItems="center" space={3} w="full">
        <Box width="32px" height="32px">
          {dappIcon}
        </Box>
        <VStack flex="1">
          <HStack alignItems="center" space={1}>
            <Typography.Body1Strong textTransform="capitalize">
              {hostname?.split('.')?.reverse?.()?.[1] ?? 'N/A'}
            </Typography.Body1Strong>
            {dappStatus}
          </HStack>
          <Typography.Caption color="text-subdued" isTruncated maxW="300px">
            {hostname}
          </Typography.Caption>
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
