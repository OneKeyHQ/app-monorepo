import { useState } from 'react';

import { Unspaced } from 'tamagui';

import {
  Button,
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

import useAppNavigation from '../../../hooks/useAppNavigation';

export function Send(props) {
  const { route } = props;
  const isNFT = route?.params?.isNFT;
  const navigation = useAppNavigation();
  const form = useForm();
  const [isUseFiat, setIsUseFiat] = useState(false);

  const handleSelectTokenPress = () => {
    navigation.pop();
  };

  return (
    <Page>
      <Page.Header title="Send" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Token" name="token">
            <ListItem
              avatarProps={{
                src: isNFT
                  ? 'https://images.glow.app/https%3A%2F%2Farweave.net%2F0WFtaZrc_DUzL2Tt_zztq-9cfJoSDhDacSfrPT50HOo%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=7af3b8e6a74c4abc0ab9de93ca67d1c4'
                  : 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
                cornerImageProps: {
                  src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
                },
              }}
              mx="$0"
              borderWidth={1}
              borderColor="$border"
              title={isNFT ? 'X Rabbit #3720' : 'USDC'}
              subtitle="Ethereum"
              onPress={isNFT ? undefined : handleSelectTokenPress}
            >
              {!isNFT && <Icon name="SwitchHorOutline" color="$iconSubdued" />}
            </ListItem>
          </Form.Field>
          <Form.Field
            name="to"
            label="To"
            rules={{ maxLength: { value: 6, message: 'maxLength is 6' } }}
          >
            <XStack space="$4" position="absolute" right="$0" top="$0">
              <IconButton
                title="Address Book"
                icon="Notebook1Outline"
                size="small"
                variant="tertiary"
              />
              <IconButton
                title="Scan"
                icon="ScanOutline"
                size="small"
                variant="tertiary"
              />
            </XStack>
            <Input size="large" placeholder="Enter address or domain" />
          </Form.Field>
          {isNFT ? (
            <Form.Field name="nftAmount" label="Amount">
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
                placeholder="Enter amount"
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
              label="Amount"
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
                placeholder="Enter amount"
                addOns={[
                  {
                    label: 'Max',
                    onPress: () => console.log('clicked'),
                  },
                ]}
              />
            </Form.Field>
          )}
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirm={() => {
          console.log('clicked');
        }}
        onConfirmText="Next"
      />
    </Page>
  );
}
