import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Center,
  Divider,
  Icon,
  IconButton,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { showOverlay } from '../../../../../utils/overlayUtils';
import { EOnboardingRoutes } from '../../../routes/enums';
import { parseDeviceInfo } from '../util';

import { ExportResult, useExportData } from './hook';

type Props = {
  serverInfo: DeviceInfo;
  clientInfo: DeviceInfo;
  serverAddress: string;
  closeOverlay: () => void;
};

function isEmptyData(data: PublicBackupData) {
  let empty = true;
  Object.entries(data).forEach(([_, value]) => {
    if (!isEmpty(value)) {
      empty = false;
    }
  });
  return empty;
}
const Content: FC<Props> = ({
  serverAddress,
  clientInfo,
  serverInfo,
  closeOverlay,
}) => {
  const [fromData, updateFromData] = useState(clientInfo);
  const [toData, updateToData] = useState(serverInfo);
  const parseFromData = parseDeviceInfo(fromData);
  const parseToData = parseDeviceInfo(toData);
  const [isSend, setIsSend] = useState(true);
  const intl = useIntl();
  const { serviceMigrate } = backgroundApiProxy;
  const { exportDataRequest } = useExportData();

  const navigation = useNavigation();

  useEffect(() => {
    if (isSend) {
      updateFromData(clientInfo);
      updateToData(serverInfo);
    } else {
      updateFromData(serverInfo);
      updateToData(clientInfo);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSend]);

  const sendAction = useCallback(async () => {
    const { status, data } = await exportDataRequest();
    if (status === ExportResult.SUCCESS) {
      const success = await serviceMigrate.sendDataToServer({
        ipAddress: serverAddress,
        data: JSON.stringify(data),
      });
      return success;
    }
    if (status === ExportResult.EMPTY) {
      ToastManager.show({
        title: 'No sendable data',
      });
    }
    return false;
  }, [exportDataRequest, serverAddress, serviceMigrate]);

  const getDataAction = useCallback(async () => {
    const data = await serviceMigrate.getDataFromServer({
      ipAddress: serverAddress,
    });
    if (data) {
      if (isEmptyData(JSON.parse(data.public))) {
        ToastManager.show({
          title: 'No Data',
        });
        return false;
      }
      closeOverlay();
      navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.MigrationPreview,
        params: { data },
      });
      return true;
    }
    return false;
  }, [closeOverlay, navigation, serverAddress, serviceMigrate]);

  const migrateAction = useCallback(async () => {
    if (isSend) {
      const success = await sendAction();
      if (success) {
        ToastManager.show({
          title: 'Data sent. Complete the import on OneKey Extension',
        });
        closeOverlay();
      }
    } else {
      await getDataAction();
    }
  }, [closeOverlay, getDataAction, isSend, sendAction]);

  return (
    <BottomSheetModal title="Migrate Data" closeOverlay={closeOverlay}>
      <Box
        bgColor="surface-default"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={1}
      >
        <Box height="92px">
          <Text typography="Body2" color="text-subdued" mt="16px" ml="16px">
            {intl.formatMessage({ id: 'content__from' })}
          </Text>
          <Box
            paddingX="16px"
            flexDirection="row"
            justifyContent="space-between"
            mt="12px"
          >
            <Text typography="Body1Strong">{parseFromData.name}</Text>
            <Icon name="PlaySolid" size={28} />
          </Box>
        </Box>
        <Divider />

        <Box height="92px">
          <Text typography="Body2" color="text-subdued" mt="16px" ml="16px">
            {intl.formatMessage({ id: 'content__to' })}
          </Text>
          <Box
            paddingX="16px"
            flexDirection="row"
            justifyContent="space-between"
            mt="12px"
          >
            <Text typography="Body1Strong">{parseToData.name}</Text>
            <Icon name="PlaySolid" size={28} />
          </Box>
        </Box>
        <Center position="absolute" width="full" height="full">
          <IconButton
            onPress={() => {
              setIsSend((prev) => !prev);
            }}
            name="SwitchVerticalOutline"
            circle
            type="basic"
            size="base"
            iconColor="icon-default"
          />
        </Center>
      </Box>
      <Button mt="24px" size="xl" type="primary" onPromise={migrateAction}>
        Migrate
      </Button>
    </BottomSheetModal>
  );
};

export const showMigrateDataModal = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);
