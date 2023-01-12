import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { HStack } from '@onekeyhq/components';

import { WText } from '../components';

import type { PageProps } from '../types';

const Safe: FC<PageProps> = () => {
  const intl = useIntl();

  const formatChunk = useCallback(
    (chunk) => (
      <WText
        fontWeight="500"
        fontSize="20px"
        color="text-success"
        px="10px"
        useCustomFont
      >
        {chunk}
      </WText>
    ),
    [],
  );

  return (
    <>
      <WText fontWeight="600" fontSize="32px" color="#E2E2E8" mb="2">
        {intl.formatMessage({
          id: 'content__in_2022_onekey_took_greater_care_of_your_wallet_security',
        })}
      </WText>
      <HStack>
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          {intl.formatMessage(
            { id: 'content__blocked_str_risk_tokens' },
            {
              b: formatChunk,
              0: '1.12M+',
            },
          )}
        </WText>
      </HStack>
      <HStack mt="2">
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          {intl.formatMessage(
            { id: 'content__monitored_str_dapps' },
            {
              b: formatChunk,
              0: '5000+',
            },
          )}
        </WText>
      </HStack>
      <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
        {intl.formatMessage({
          id: 'content__prevented_zero_transfer_scams_avoiding_sandwich_attack_in_swap',
        })}
      </WText>
      <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
        ...
      </WText>

      <WText fontWeight="600" fontSize="20px" mt="6" color="#E2E2E8">
        {intl.formatMessage({
          id: 'content__we_ll_continue_to_secure_your_assets_in_2023',
        })}
      </WText>
    </>
  );
};

export default Safe;
