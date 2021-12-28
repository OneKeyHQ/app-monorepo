import React from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Form,
  Icon,
  IconButton,
  Modal,
  Select,
  Token,
  Typography,
  useForm,
} from '@onekeyhq/components';

import TransactionConfirm from './transactionConfirm';
import TransactionEditFee from './transactionEditFee';

type TransactionValues = {
  username: string;
  email: string;
  description: string;
  agreement: boolean;
  isDev: boolean;
  options: string;
};

type AssetType = {
  token: string;
  name: string;
  balance: string;
};
const AssetMockData: AssetType[] = [
  {
    token: 'ETH',
    name: 'ETH',
    balance: '2.11014',
  },
  {
    token: 'USDT',
    name: 'USDT',
    balance: '2.11014',
  },
  {
    token: 'BTC',
    name: 'BTC',
    balance: '2.11014',
  },
];

function selectOptionData() {
  const options = [];
  for (let index = 0; index < AssetMockData.length; index += 1) {
    const asset = AssetMockData[index];
    options.push({
      label: asset.token,
      value: asset,
    });
  }

  return options;
}

const Transaction = ({ ...rest }) => {
  const { control, handleSubmit } = useForm<TransactionValues>();
  const onSubmit = handleSubmit((data) => console.log(data));
  const intl = useIntl();
  const { trigger } = rest;
  const renderSelecterItem = (asset: AssetType) => (
    <Row space="12px">
      <Token chain={asset.token} size="32px" />
      <Column>
        <Typography.Body2Strong>{asset.name}</Typography.Body2Strong>
        <Typography.Body2 color="text-subdued">
          {asset.balance}
        </Typography.Body2>
      </Column>
    </Row>
  );

  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__send' })}
      trigger={trigger}
      footer={
        <Column>
          <Divider />
          <Row
            justifyContent="space-between"
            alignItems="center"
            paddingX="24px"
            paddingY="16px"
          >
            <Column>
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'content__total' })}
              </Typography.Body2>
              <Typography.Body1Strong>0 ETH</Typography.Body1Strong>
              <Typography.Caption color="text-subdued">
                3 min
              </Typography.Caption>
            </Column>

            <TransactionConfirm
              trigger={
                <Button
                  type="primary"
                  size="lg"
                  isDisabled={false}
                  onPress={onSubmit}
                >
                  <Typography.Body1Strong>
                    {intl.formatMessage({ id: 'action__continue' })}
                  </Typography.Body1Strong>
                </Button>
              }
            />
          </Row>
        </Column>
      }
    >
      <Column flex="1">
        <Form>
          <Row justifyContent="space-between">
            <Typography.Body2Strong>
              {intl.formatMessage({ id: 'action__send' })}
            </Typography.Body2Strong>
            <Row space="4px">
              <IconButton
                iconSize={20}
                size="xs"
                name="BookOpenSolid"
                type="plain"
              />
              <IconButton
                iconSize={20}
                size="xs"
                name="ClipboardSolid"
                type="plain"
              />
              <IconButton
                iconSize={20}
                size="xs"
                name="ScanSolid"
                type="plain"
              />
            </Row>
          </Row>
          <Form.Item
            control={control}
            name="description"
            rules={{
              required: intl.formatMessage({ id: 'form__address_invalid' }),
            }}
            defaultValue=""
          >
            <Form.Textarea
              placeholder={intl.formatMessage({ id: 'form__address' })}
              borderRadius="12px"
            />
          </Form.Item>
          <Typography.Body2Strong mt="24px" mb="4px">
            {intl.formatMessage({ id: 'content__asset' })}
          </Typography.Body2Strong>
          <Select
            // onChange={(v) => {}}
            headerShown={false}
            footer={null}
            containerProps={{
              width: '100%',
              zIndex: 999,
              borderColor: 'border-default',
              borderWidth: '1px',
              borderRadius: '12px',
              mb: '24px',
            }}
            renderTrigger={() => (
              <Row justifyContent="space-between" alignItems="center" flex={1}>
                {renderSelecterItem(AssetMockData[0])}
                <Icon name="ChevronDownSolid" size={20} />
              </Row>
            )}
            renderItem={(item) => (
              <Column pt="8px">{renderSelecterItem(item.value)}</Column>
            )}
            options={selectOptionData()}
          />
          <Form.Item
            label={intl.formatMessage({ id: 'content__amount' })}
            control={control}
            name="username"
            defaultValue=""
            rules={{
              required: intl.formatMessage({ id: 'form__amount_invalid' }),
            }}
          >
            <Form.Input
              w="100%"
              rightSecondaryText={intl.formatMessage({ id: 'action__max' })}
              rightText="ETH"
            />
          </Form.Item>
          <Typography.Body2 mt="8px" color="text-subdued">
            0 USD
          </Typography.Body2>
          <Typography.Body2Strong mt="24px" mb="4px">
            {intl.formatMessage({ id: 'content__fee' })}
          </Typography.Body2Strong>
          <Row
            justifyContent="space-between"
            alignItems="center"
            bgColor="surface-default"
            borderColor="border-default"
            borderWidth="1px"
            borderRadius="12px"
            paddingX="12px"
            paddingY="8px"
          >
            <Column>
              <Typography.Body1Strong>
                Normal (64.11 Gwei)
              </Typography.Body1Strong>
              <Typography.Body2 color="text-subdued">
                0.001694 ETH ~ 0.001977 ETH
              </Typography.Body2>
              <Typography.Body2 color="text-subdued">3 min</Typography.Body2>
            </Column>
            <TransactionEditFee
              trigger={
                <IconButton
                  iconSize={20}
                  size="xs"
                  name="PencilSolid"
                  type="plain"
                />
              }
            />
          </Row>
          <Box height="50px" />
        </Form>
      </Column>
    </Modal>
  );
};
export default Transaction;
