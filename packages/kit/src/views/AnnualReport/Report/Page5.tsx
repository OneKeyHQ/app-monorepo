import type { FC } from 'react';

import { useIntl } from 'react-intl';

import bg from '@onekeyhq/kit/assets/annual/6.png';

import { Container, WText } from '../components';

const AnnualPage5: FC<{ height: number }> = ({ height }) => {
  const intl = useIntl();
  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText fontWeight="600" fontSize="32px" color="#E2E2E8" lineHeight="40px">
        {intl.formatMessage({
          id: 'content__did_you_get_away_with_most_of_the_rug_pulls_this_year',
        })}
      </WText>
      <WText fontWeight="900" fontSize="24px" color="text-success" mt="9">
        2022.05.13
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8">
        {intl.formatMessage({ id: 'content__luna_crash' })}
      </WText>
      <WText fontWeight="900" fontSize="24px" color="text-success" mt="7">
        2022.11.11
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8">
        {intl.formatMessage({ id: 'content__ftx_collapse' })}
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mt="7" mb="9">
        ...
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mb="4">
        {intl.formatMessage({
          id: 'content__have_you_been_spared_this_year_we_hope_you_re_the',
        })}
      </WText>
      <WText fontWeight="700" fontSize="40px" color="text-success">
        {intl.formatMessage({ id: 'content__anti_rug_master' })}
      </WText>
    </Container>
  );
};

export default AnnualPage5;
