import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Form,
  Modal,
  useForm,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { DappApproveModalRoutes, DappApproveRoutesParams } from '../../routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type FeeValues = {
  spendLimit: string;
};

type NavigationProps = NativeStackNavigationProp<
  DappApproveRoutesParams,
  DappApproveModalRoutes.SpendLimitModal
>;

// const UINT_64 = 2 ** 64 - 1;
// 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
// const UINT_256 = 2 ** 256 - 1;

const SpendLimitAmount = ({ ...rest }) => {
  const { trigger } = rest;
  const intl = useIntl();

  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();

  const { control, setValue, handleSubmit } = useForm<FeeValues>();
  const onSubmit = handleSubmit((data) => {
    if (!navigation.canGoBack()) {
      return;
    }

    const { routes, index } = navigation.getState();
    const prevRouteName = routes[index - 1].name;
    navigation.navigate(prevRouteName, {
      spendLimit: data.spendLimit,
    });
  });
  const useMaxSpendLimit = useCallback(() => {
    setValue('spendLimit', intl.formatMessage({ id: 'form__unlimited' }));
  }, [intl, setValue]);

  const { bottom } = useSafeAreaInsets();
  const footer = (
    <Column>
      <Divider />
      <Row
        justifyContent="flex-end"
        alignItems="center"
        px={{ base: 4, md: 6 }}
        pt={4}
        pb={4 + bottom}
      >
        <Button
          flexGrow={isSmallScreen ? 1 : 0}
          type="primary"
          size={isSmallScreen ? 'lg' : 'base'}
          isDisabled={false}
          onPress={onSubmit}
        >
          {intl.formatMessage({ id: 'action__save' })}
        </Button>
      </Row>
    </Column>
  );

  return (
    <Modal
      trigger={trigger}
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'content__spend_limit_amount' })}
      footer={footer}
      scrollViewProps={{
        children: (
          <Form>
            <Form.Item
              label={intl.formatMessage({
                id: 'form__max_spend_limit',
              })}
              control={control}
              name="spendLimit"
              defaultValue={intl.formatMessage({ id: 'form__unlimited' })}
              helpText={intl.formatMessage({
                id: 'content__if_you_choose_max',
              })}
            >
              <Form.Input
                rightText="ETH"
                rightSecondaryText={intl.formatMessage({ id: 'action__max' })}
                onPressSecondaryRightText={useMaxSpendLimit}
              />
            </Form.Item>
          </Form>
        ),
      }}
    />
  );
};

export default SpendLimitAmount;
