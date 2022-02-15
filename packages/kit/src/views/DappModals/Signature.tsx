import React, { useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import { Center, Modal, Token, Typography } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';

import { DescriptionList, DescriptionListItem } from './DescriptionList';
import RugConfirmDialog from './RugConfirmDialog';

const MockData = {
  token: {
    name: 'ETH',
    chain: 'Ethereum',
    url: '',
  },
  target: 'app.uniswap.org',
  fromAddress: '0x4d16878c270x4d16878c270x4',
  message:
    'We take your signature as a proof of owner to your wallet, message: `0x7550ad0f357d231341c1eb84be618253`',
};

const isRug = (target: string) => {
  const RUG_LIST = ['app.uniswap.org'];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

const Signature = () => {
  const intl = useIntl();
  const computedIsRug = isRug(MockData.target);
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const navigator = useNavigation();

  return (
    <>
      <RugConfirmDialog
        visible={rugConfirmDialogVisible}
        onCancel={() => setRugConfirmDialogVisible(false)}
        onConfirm={() => {
          // Do something on user confirm
        }}
      />
      <Modal
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__reject"
        header={intl.formatMessage({ id: 'title__signature_request' })}
        headerDescription={MockData.target}
        onPrimaryActionPress={({ onClose }) => {
          if (!computedIsRug) {
            // Do approve operation
            return onClose?.();
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
        onSecondaryActionPress={() => {
          if (navigator.canGoBack()) {
            navigator.goBack();
          }
        }}
        scrollViewProps={{
          children: (
            <Column flex="1" space={6}>
              <Center>
                <Token chain={MockData.token.chain} size="56px" />
                <Typography.Heading mt="8px">
                  {`${MockData.token.name}(${MockData.token.chain})`}
                </Typography.Heading>
              </Center>

              <DescriptionList>
                {/* Account */}
                <DescriptionListItem
                  // TODO: Replace this translation to titlelized account
                  title={intl.formatMessage({
                    id: 'content__account_lowercase',
                  })}
                  detail={
                    <Column alignItems="flex-end" w="auto" flex={1}>
                      <Text
                        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      >
                        ETH #1
                      </Text>
                      <Typography.Body2 textAlign="right" color="text-subdued">
                        {MockData.fromAddress}
                      </Typography.Body2>
                    </Column>
                  }
                />

                {/* Interact target */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'content__interact_with',
                  })}
                  detail={MockData.target}
                  isRug={computedIsRug}
                />
              </DescriptionList>

              <Column space={2}>
                <Typography.Subheading mt="24px" color="text-subdued">
                  {intl.formatMessage({
                    id: 'form__message_uppercase',
                  })}
                </Typography.Subheading>

                <DescriptionList>
                  <DescriptionListItem>
                    <Typography.Body2 color="text-default" numberOfLines={233}>
                      {MockData.message}
                    </Typography.Body2>
                  </DescriptionListItem>
                </DescriptionList>
              </Column>
            </Column>
          ),
        }}
      />
    </>
  );
};

export default Signature;
