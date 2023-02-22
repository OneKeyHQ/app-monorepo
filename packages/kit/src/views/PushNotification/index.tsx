import type { FC, ReactElement } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  ScrollView,
  Select,
  Spinner,
  Switch,
  Text,
  useTheme,
} from '@onekeyhq/components';
import type { PressableItemProps } from '@onekeyhq/components/src/Pressable/Pressable';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import { useSettings, useStatus } from '@onekeyhq/kit/src/hooks/redux';
import type { SettingsState } from '@onekeyhq/kit/src/store/reducers/settings';
import {
  defaultPushNotification,
  setPushNotificationConfig,
} from '@onekeyhq/kit/src/store/reducers/settings';

import { HomeRoutes } from '../../routes/routesEnum';

import { useEnabledAccountDynamicAccounts, usePriceAlertlist } from './hooks';

import type { HomeRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.PushNotification
>;

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
    p={4}
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
    <Box ml="3">
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
    <Text mr="19px">{desc}</Text>
    <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
  </Box>
);

const PressabelFooter = ({
  title,
  desc,
  onPress,
}: {
  title: string;
  desc: string;
  onPress: PressableItemProps['onPress'];
}) => (
  <Pressable onPress={onPress}>
    <Box flexDirection="row" p="4">
      <Text flex={1} typography="Body1Strong">
        {title}
      </Text>
      <Text mr="19px">{desc}</Text>
      <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
    </Box>
  </Pressable>
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
  footer?: ReactElement;
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
        {switchs?.[0]?.value && footer ? footer : null}
      </Box>
      {extraText && (
        <Text mt={2} color="text-subdued" typography="Caption">
          {extraText}
        </Text>
      )}
    </>
  );
};

const PushNotification = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const isFocused = useIsFocused();
  const { authenticationType } = useStatus();
  const { alerts, fetchPriceAlerts } = usePriceAlertlist();
  const { enabledAccounts, refresh } = useEnabledAccountDynamicAccounts();
  const { pushNotification = defaultPushNotification, devMode } = useSettings();
  const { serviceNotification } = backgroundApiProxy;

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'form__notification' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl, authenticationType]);

  const onChangePushNotification = useCallback(
    (key: keyof Required<SettingsState>['pushNotification']) =>
      (value: string | number | boolean) => {
        const { dispatch } = backgroundApiProxy;
        dispatch(
          setPushNotificationConfig({
            [key]: value,
          }),
        );
        serviceNotification.syncPushNotificationConfig();
      },
    [serviceNotification],
  );

  useEffect(() => {
    if (isFocused) {
      refresh();
      fetchPriceAlerts();
    }
  }, [fetchPriceAlerts, isFocused, refresh]);

  const validThresholds = useMemo(() => {
    // for test
    if (devMode?.enableZeroNotificationThreshold) {
      return [0, ...thresholds];
    }
    return thresholds;
  }, [devMode?.enableZeroNotificationThreshold]);

  const extra = useMemo(() => {
    if (!pushNotification?.pushEnable) {
      return null;
    }
    return (
      <>
        <NotificationArea
          title={intl.formatMessage({ id: 'form__market_uppercase' })}
          switchs={[
            {
              title: intl.formatMessage({
                id: 'form__btc_and_eth_movement',
              }),
              desc: intl.formatMessage({
                id: 'form__btc_and_eth_movement_desc',
              }),
              value: pushNotification.btcAndEthPriceAlertEnable,
              onChange: onChangePushNotification('btcAndEthPriceAlertEnable'),
            },
            {
              title: intl.formatMessage({
                id: 'title__favorite',
              }),
              desc: intl.formatMessage({
                id: 'form__favorite_desc',
              }),
              value: pushNotification.favoriteTokensPriceAlertEnable,
              onChange: onChangePushNotification(
                'favoriteTokensPriceAlertEnable',
              ),
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
        <NotificationArea
          title={intl.formatMessage({ id: 'form__alert_uppercase' })}
          switchs={[
            {
              title: intl.formatMessage({
                id: 'form__price_alert',
              }),
              desc: intl.formatMessage({
                id: 'form__price_alert_desc',
              }),
              value: pushNotification.priceAlertEnable,
              onChange: onChangePushNotification('priceAlertEnable'),
            },
          ]}
          footer={
            <PressabelFooter
              title={intl.formatMessage({
                id: 'form__manage',
              })}
              desc={
                alerts === undefined
                  ? ((<Spinner size="sm" />) as unknown as string)
                  : String(alerts.length)
              }
              onPress={() =>
                navigation.navigate(
                  HomeRoutes.PushNotificationManagePriceAlert,
                  {
                    alerts: alerts || [],
                  },
                )
              }
            />
          }
        />
        <NotificationArea
          title={intl.formatMessage({ id: 'form__account_uppercase' })}
          switchs={[
            {
              title: intl.formatMessage({
                id: 'form__account_dynamic_notification',
              }),
              desc: intl.formatMessage({
                id: 'form__account_dynamic_notification_desc',
              }),
              value: pushNotification.accountActivityPushEnable,
              onChange: onChangePushNotification('accountActivityPushEnable'),
            },
          ]}
          footer={
            <PressabelFooter
              title={intl.formatMessage({
                id: 'form__manage',
              })}
              desc={
                enabledAccounts === undefined
                  ? ((<Spinner size="sm" />) as unknown as string)
                  : String(enabledAccounts.length)
              }
              onPress={() =>
                navigation.navigate(
                  HomeRoutes.PushNotificationManageAccountDynamic,
                )
              }
            />
          }
        />
      </>
    );
  }, [
    enabledAccounts,
    alerts,
    navigation,
    intl,
    onChangePushNotification,
    pushNotification,
    validThresholds,
  ]);

  return (
    <ScrollView
      w="full"
      h="full"
      bg="background-default"
      p="4"
      maxW={768}
      mx="auto"
    >
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
      {extra}
      <Box height={10} />
    </ScrollView>
  );
};

export default PushNotification;
