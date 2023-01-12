import type { FC } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { HStack, VStack } from '@onekeyhq/components';

import { WText } from '../components';

import type { PageProps } from '../types';

const Rug: FC<PageProps> = () => {
  const intl = useIntl();
  const { height } = useWindowDimensions();
  return (
    <>
      <WText fontWeight="600" fontSize="32px" color="#E2E2E8" lineHeight="40px">
        {intl.formatMessage({
          id: 'content__did_you_get_away_with_most_of_the_rug_pulls_this_year',
        })}
      </WText>
      <HStack
        alignItems="center"
        flexWrap="wrap"
        mt="9"
        justifyContent="space-between"
      >
        <VStack w={height < 800 ? undefined : 'full'}>
          <WText
            fontWeight="900"
            fontSize="24px"
            color="text-success"
            useCustomFont
          >
            2022.05.13
          </WText>
          <WText fontWeight="500" fontSize="24px" color="#E2E2E8">
            {intl.formatMessage({ id: 'content__luna_crash' })}
          </WText>
        </VStack>
        <VStack>
          <WText
            fontWeight="900"
            fontSize="24px"
            color="text-success"
            useCustomFont
          >
            2022.11.11
          </WText>
          <WText fontWeight="500" fontSize="24px" color="#E2E2E8">
            {intl.formatMessage({ id: 'content__ftx_collapse' })}
          </WText>
        </VStack>
      </HStack>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mt="7" mb="9">
        ...
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mb="4">
        {intl.formatMessage({
          id: 'content__have_you_been_spared_this_year_we_hope_you_re_the',
        })}
      </WText>
      <WText
        fontWeight="700"
        fontSize="40px"
        color="text-success"
        useCustomFont
      >
        {intl.formatMessage({ id: 'content__anti_rug_master' })}
      </WText>
    </>
  );
};

export default Rug;
