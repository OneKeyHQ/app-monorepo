import type { FC } from 'react';

import { HStack } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/7.png';

import { Container, WText } from '../components';
import { useIntl } from 'react-intl';

const AnnualPage6: FC<{ height: number }> = ({ height }) => {
  console.log(1);
  const intl = useIntl();
  return (
    <Container bg={bg} height={height} showLogo={false}>
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
              0: (
                <WText
                  fontWeight="500"
                  fontSize="20px"
                  color="text-success"
                  px="10px"
                >
                  1.12M+
                </WText>
              ),
            },
          )}
        </WText>
      </HStack>
      <HStack mt="2">
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          {intl.formatMessage(
            { id: 'content__monitored_str_dapps' },
            {
              0: (
                <WText
                  fontWeight="500"
                  fontSize="20px"
                  color="text-success"
                  px="10px"
                >
                  5000+
                </WText>
              ),
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
    </Container>
  );
};

export default AnnualPage6;
