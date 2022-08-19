import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import {
  Box,
  DialogManager,
  Icon,
  Select,
  Switch,
  Text,
  useTheme,
} from '@onekeyhq/components';
import { SelectItem } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import { useSettings, useStatus } from '@onekeyhq/kit/src/hooks/redux';
import {
  SettingsState,
  defaultPushNotification,
  setPushNotificationConfig,
} from '@onekeyhq/kit/src/store/reducers/settings';
import {
  checkPushNotificationPermission,
  initJpush,
} from '@onekeyhq/shared/src/notification';

type OptionsProps = {
  title: string;
  onChange: (value: boolean) => void;
  value: boolean;
  desc?: string;
  divider?: boolean;
};

const thresholds = [5, 8, 10];

const Options: FC<OptionsProps> = ({
  title,
  onChange,
  value,
  desc,
  divider,
}) => (
  <Box
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    py={4}
    px={{ base: 4, md: 6 }}
    borderBottomWidth={divider ? '1 ' : undefined}
    borderBottomColor="divider"
    borderBottomRadius={divider ? undefined : '12px'}
  >
    <Box flex="1">
      <Text typography="Body1Strong" numberOfLines={1}>
        {title}
      </Text>
      {desc && (
        <Text color="text-subdued" typography="Body2" numberOfLines={2}>
          {desc}
        </Text>
      )}
    </Box>
    <Box>
      <Switch
        labelType="false"
        isChecked={value}
        onToggle={() => onChange?.(!value)}
      />
    </Box>
  </Box>
);

const SelectTrigger = ({ title, desc }: { title: string; desc: string }) => (
  <Box flexDirection="row" p="4">
    <Text flex={1} typography="Body1Strong">
      {title}
    </Text>
    <Text>{desc}</Text>
    <Icon name="ChevronRightSolid" size={20} />
  </Box>
);

const SelectFooter = ({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: number;
  onChange: (value: number) => void;
  options: SelectItem<number>[];
}) => (
  <Select<number>
    title={title}
    isTriggerPlain
    footer={null}
    headerShown={false}
    defaultValue={value}
    onChange={onChange}
    options={options}
    dropdownProps={{ width: '64' }}
    dropdownPosition="right"
    renderTrigger={() => <SelectTrigger title={title} desc={`${value}%`} />}
  />
);

const NotificationArea = ({
  title,
  switchs,
  footer,
  extraText,
}: {
  title?: string;
  switchs: OptionsProps[];
  footer?: React.ReactElement;
  extraText?: string;
}) => {
  const { themeVariant } = useTheme();
  const switchLen = switchs.length;
  return (
    <>
      {title && (
        <Text mt={6} color="text-subdued">
          {title}
        </Text>
      )}
      <Box
        w="full"
        mt="2"
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {switchs.map((s, index) => (
          <Options
            {...s}
            key={s.title}
            divider={!!footer || index !== switchLen - 1}
          />
        ))}
        {footer || null}
      </Box>
      {extraText && <Text mt={2}>{extraText}</Text>}
    </>
  );
};

const PushNotification = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { authenticationType } = useStatus();
  const { pushNotification = defaultPushNotification, devMode } = useSettings();
  const { dispatch, engine } = backgroundApiProxy;

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'form__notification' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl, authenticationType]);

  const onChangePushNotification = useCallback(
    (key: keyof Required<SettingsState>['pushNotification']) =>
      (value: string | number | boolean) => {
        dispatch(
          setPushNotificationConfig({
            [key]: value,
          }),
        );
        engine.syncPushNotificationConfig();
      },
    [dispatch, engine],
  );

  const checkPermission = useCallback(async () => {
    const hasPermission = await checkPushNotificationPermission();
    if (hasPermission) {
      return;
    }
    if (!pushNotification.pushEnable) {
      return;
    }
    onChangePushNotification('pushEnable')(false);
    DialogManager.show({
      render: <PermissionDialog type="notification" />,
    });
  }, [onChangePushNotification, pushNotification.pushEnable]);

  useEffect(() => {
    if (pushNotification.pushEnable) {
      initJpush().finally(() => {
        checkPermission();
      });
    }
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pushNotification.pushEnable) {
        checkPermission();
      }
    });
    return () => {
      listener.remove();
    };
  }, [checkPermission, pushNotification.pushEnable]);

  const validThresholds = useMemo(() => {
    // for test
    if (devMode?.enableZeroNotificationThreshold) {
      return [0, ...thresholds];
    }
    return thresholds;
  }, [devMode?.enableZeroNotificationThreshold]);

  const marketArea = useMemo(
    () => (
      <NotificationArea
        title={intl.formatMessage({ id: 'form__market_uppercase' })}
        switchs={[
          {
            title: intl.formatMessage({
              id: 'form__market_uppercase',
            }),
            desc: intl.formatMessage({
              id: 'form__btc_and_eth_movement_desc',
            }),
            value: pushNotification.btcAndEthPriceAlertEnable,
            onChange: onChangePushNotification('btcAndEthPriceAlertEnable'),
          },
        ]}
        footer={
          <SelectFooter
            title={intl.formatMessage({
              id: 'form__manage_threshold',
            })}
            value={pushNotification.threshold || validThresholds[0]}
            onChange={onChangePushNotification('threshold')}
            options={validThresholds.map((n) => ({
              label: `${n}%`,
              value: n,
            }))}
          />
        }
      />
    ),
    [intl, onChangePushNotification, pushNotification, validThresholds],
  );

  return (
    <Box w="full" h="full" bg="background-default" p="4" maxW={768} mx="auto">
      <NotificationArea
        extraText={intl.formatMessage({
          id: 'content__receive_notifications_of_account_dynamics_and_asset_changes',
        })}
        switchs={[
          {
            title: intl.formatMessage({
              id: 'form__notification',
            }),
            value: pushNotification.pushEnable,
            onChange: onChangePushNotification('pushEnable'),
          },
        ]}
      />
      {pushNotification.pushEnable && marketArea}
    </Box>
  );
};

export default React.memo(PushNotification);
