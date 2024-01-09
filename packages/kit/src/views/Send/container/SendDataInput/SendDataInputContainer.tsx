import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  IconButton,
  Input,
  ListItem,
  Page,
  SizableText,
  XStack,
  useForm,
} from '@onekeyhq/components';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendDataInputContainer() {
  const intl = useIntl();
  const form = useForm();
  const [isUseFiat, setIsUseFiat] = useState(false);
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendDataInput>>();

  const { isNFT, token, nfts } = route.params;

  const nft = nfts?.[0];

  const handleOnSelectToken = useCallback(() => {}, []);
  const handleOnSendMax = useCallback(() => {}, []);
  const handleOnConfirm = useCallback(() => {}, []);

  return (
    <Page>
      <Page.Header title="Send" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: 'form__token' })}
            name="token"
          >
            <ListItem
              avatarProps={{
                src: isNFT ? nft?.metadata.image : token?.logoURI,
              }}
              mx="$0"
              borderWidth={1}
              borderColor="$border"
              title={isNFT ? nft?.metadata?.name : token?.name}
              subtitle="Ethereum"
              onPress={isNFT ? undefined : handleOnSelectToken}
            >
              {!isNFT && <Icon name="SwitchHorOutline" color="$iconSubdued" />}
            </ListItem>
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({ id: 'form__to_uppercase' })}
            name="to"
            rules={{ required: true }}
          >
            <XStack space="$4" position="absolute" right="$0" top="$0">
              <IconButton
                title={intl.formatMessage({ id: 'title__address_book' })}
                icon="Notebook1Outline"
                size="small"
                variant="tertiary"
              />
              <IconButton
                title={intl.formatMessage({ id: 'action__scan' })}
                icon="ScanOutline"
                size="small"
                variant="tertiary"
              />
            </XStack>
            <Input
              size="large"
              placeholder={intl.formatMessage({
                id: 'form__address_and_domain_placeholder',
              })}
            />
          </Form.Field>
          {isNFT ? (
            <Form.Field
              name="nftAmount"
              label={intl.formatMessage({ id: 'form__amount' })}
              rules={{ required: true }}
            >
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                position="absolute"
                right="$0"
                top="$0"
              >
                Available: 9999
              </SizableText>
              <Input
                size="large"
                placeholder={intl.formatMessage({ id: 'action__enter_amount' })}
                addOns={[
                  {
                    label: 'Max',
                    onPress: () => console.log('clicked'),
                  },
                ]}
              />
            </Form.Field>
          ) : (
            <Form.Field
              name="amount"
              label={intl.formatMessage({ id: 'form__amount' })}
              rules={{ required: true }}
              description={
                <XStack pt="$1.5" alignItems="center">
                  <SizableText size="$bodyLg" color="$textSubdued" pr="$1">
                    ≈ {isUseFiat ? '$0' : '0 USDC'}
                  </SizableText>
                  <IconButton
                    title="Enter amount as fiat"
                    icon="SwitchVerOutline"
                    size="small"
                    iconProps={{
                      size: '$4',
                    }}
                    onPress={() => setIsUseFiat(!isUseFiat)}
                  />
                </XStack>
              }
            >
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                position="absolute"
                right="$0"
                top="$0"
              >
                Balance: {isUseFiat ? '$4,000.00' : '4000 USDC'}
              </SizableText>
              <Input
                size="large"
                placeholder={intl.formatMessage({ id: 'action__enter_amount' })}
                addOns={[
                  {
                    label: intl.formatMessage({ id: 'action__max' }),
                    onPress: handleOnSendMax,
                  },
                ]}
              />
            </Form.Field>
          )}
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirm={handleOnConfirm}
        onConfirmText={intl.formatMessage({ id: 'action__next' })}
      />
    </Page>
  );
}

export { SendDataInputContainer };
