import React, { FC } from 'react';

import cloudBackup from '@onekeyhq/app/src/cloudBackup';
import { Box, Button, Form, useForm } from '@onekeyhq/components';

type BackupValues = {
  backupData: string;
};

const BackupDemo: FC = () => {
  const { control, handleSubmit } = useForm<BackupValues>({ mode: 'onChange' });
  const onSubmit = handleSubmit(async (data) => {
    const { backupData } = data;
    if (backupData.length > 0) {
      const result = await cloudBackup.backupUserDataIntoCloud(backupData);
      console.log('result = ', result);
    } else {
      console.log('error: can not backup null data');
    }
  });

  return (
    <Box flex="1" bg="background-hovered">
      <Form>
        <Form.Item
          control={control}
          name="backupData"
          formControlProps={{ width: 'full' }}
          defaultValue=""
        >
          <Form.Textarea
            placeholder="encrypted information"
            borderRadius="12px"
          />
        </Form.Item>
        <Button height={44} type="primary" size="base" onPromise={onSubmit}>
          Backup
        </Button>
      </Form>
    </Box>
  );
};

const FetchDataDemo: FC = () => {
  const { control, handleSubmit, setValue } = useForm<BackupValues>({
    mode: 'onChange',
  });
  const onSubmit = handleSubmit(async () => {
    const result = (await cloudBackup.fetchUserDataFromCloud()) ?? '';
    setValue('backupData', result);
  });

  return (
    <Box flex="1" bg="background-hovered">
      <Form>
        <Form.Item
          control={control}
          name="backupData"
          formControlProps={{ width: 'full' }}
          defaultValue=""
        >
          <Form.Textarea
            placeholder="encrypted information"
            borderRadius="12px"
            isDisabled
          />
        </Form.Item>
        <Button height={44} type="primary" size="base" onPromise={onSubmit}>
          Fetch data
        </Button>
      </Form>
    </Box>
  );
};

const CloudBackupGallery = () => (
  <Box flex="1" bg="background-hovered">
    <BackupDemo />
    <FetchDataDemo />
  </Box>
);

export default CloudBackupGallery;
