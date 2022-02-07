import React from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  IconButton,
  Modal,
  Pressable,
  Stack,
  Typography,
} from '@onekeyhq/components';

const CreateWhatWallet = () => {
  const intl = useIntl();
  return (
    <Modal footer={null}>
      <Box display="flex" flexDirection="column" alignItems="center" mb="8">
        <Typography.DisplayLarge>
          {intl.formatMessage({
            id: 'action__create_wallet',
            defaultMessage: 'Create Wallet',
          })}
        </Typography.DisplayLarge>
        <Typography.Body1 color="text-subdued" mt="2">
          {intl.formatMessage({
            id: 'content__select_wallet_type',
            defaultMessage: 'Choose a type to set up',
          })}
        </Typography.Body1>
      </Box>
      <Pressable p="4" bg="background-default" borderRadius={12}>
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          mb="3"
        >
          <Button>🤑</Button>
          <IconButton type="plain" name="ChevronRightOutline" />
        </Box>
        <Typography.Body1Strong>
          {intl.formatMessage({
            id: 'wallet__app_wallet',
            defaultMessage: 'App Wallet',
          })}
        </Typography.Body1Strong>
        <Typography.Body2 color="text-subdued" mt="1">
          {intl.formatMessage({
            id: 'content__app_wallet_desc',
            defaultMessage: 'Add your usual petty coin wallet.',
          })}
        </Typography.Body2>
        <Typography.Caption color="text-disabled" mt="4">
          {intl.formatMessage({
            id: 'content__for_people_who_dont_have_hardware_wallet',
            defaultMessage: 'For people who don’t have hardware wallet.',
          })}
        </Typography.Caption>
      </Pressable>
      <Box p="4" bg="background-default" borderRadius={12} mt="4">
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          mb="3"
        >
          <IconButton name="DeviceMobileOutline" />
          <Box bg="surface-neutral-default" borderRadius={6} px="1.5" py="0.5">
            <Typography.CaptionStrong>
              {intl.formatMessage({
                id: 'badge__coming_soon',
                defaultMessage: 'Coming Soon',
              })}
            </Typography.CaptionStrong>
          </Box>
        </Box>
        <Typography.Body1Strong>
          {intl.formatMessage({
            id: 'wallet__hardware_wallet',
            defaultMessage: 'Hardware Wallet',
          })}
        </Typography.Body1Strong>
        <Typography.Body2 color="text-subdued" mt="1">
          {intl.formatMessage({
            id: 'content__hardware_wallet_desc',
            defaultMessage:
              'Storing your assets offline. Confirm on the device when making transfers and signing.',
          })}
        </Typography.Body2>
        <Typography.Caption color="text-disabled" mt="4">
          {intl.formatMessage({
            id: 'content__for_people_who_have_hardware_wallet',
            defaultMessage: 'For people who have hardware wallet.',
          })}
        </Typography.Caption>
      </Box>
      <Box
        mt="10"
        display="flex"
        flexDirection="row"
        justifyContent="center"
        alignItems="center"
      >
        <Stack direction="row" space={1}>
          <Typography.Body1Strong>Import</Typography.Body1Strong>
          <Typography.Body1 color="text-subdued">or</Typography.Body1>
          <Typography.Body1Strong>Watch</Typography.Body1Strong>
          <Typography.Body1 color="text-subdued">account</Typography.Body1>
        </Stack>
      </Box>
    </Modal>
  );
};

export default CreateWhatWallet;
