import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Center,
  Divider,
  GroupingList,
  HStack,
  Icon,
  Image,
  List,
  Modal,
  Pressable,
  Spinner,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { tokenSecurityRiskItems } from '@onekeyhq/engine/src/managers/goplus';
import type { GoPlusTokenSecurity } from '@onekeyhq/engine/src/types/goplus';
import goPlus from '@onekeyhq/kit/assets/goPlus.png';
import NoRisks from '@onekeyhq/kit/assets/NoRisks.png';

import { openUrl } from '../../utils/openUrl';

import { useTokenSecurityInfo } from './hooks';

import type { ManageTokenModalRoutes } from '../../routes/routesEnum';
import type { ManageTokenRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.TokenRiskDetail
>;

const RiskDetail: FC = () => {
  const intl = useIntl();
  const insets = useSafeAreaInsets();
  const route = useRoute<NavigationProps>();
  const {
    token: { networkId, address },
  } = route.params;
  const { loading, data } = useTokenSecurityInfo(networkId, address);

  const { safe, danger, hasSecurity, warn } = data;

  const isSingleList = useMemo(() => {
    if (!hasSecurity) {
      return true;
    }
    return !danger?.length || !warn?.length;
  }, [danger, warn, hasSecurity]);

  const linkToGoPlus = useCallback(() => {
    openUrl('https://gopluslabs.io/');
  }, []);

  const header = useMemo(() => {
    if (hasSecurity) {
      if (danger?.length) {
        return (
          <Center mt="6" mb="8">
            <Icon
              name="ExclamationTriangleMini"
              color="icon-warning"
              size={44}
            />
            <Typography.DisplayLarge mt="2">
              {intl.formatMessage({ id: 'title__possible_risky_token' })}
            </Typography.DisplayLarge>
          </Center>
        );
      }

      return (
        <Center mt="6" mb="8">
          <Icon name="ExclamationCircleMini" color="icon-subdued" size={44} />
          <Typography.DisplayLarge mt="2">
            {intl.formatMessage({ id: 'title__token_that_needs_caution' })}
          </Typography.DisplayLarge>
        </Center>
      );
    }

    return (
      <Center mt="6" mb="8">
        <Image size="56px" source={NoRisks} mb="2" />
        <Typography.DisplayLarge mb="2">
          {intl.formatMessage({ id: 'form__no_risks' })}
        </Typography.DisplayLarge>
        <Typography.Body1 color="text-subdued">
          {intl.formatMessage(
            { id: 'form__no_risks_desc' },
            { 0: safe?.length ?? 0 },
          )}
        </Typography.Body1>
      </Center>
    );
  }, [hasSecurity, intl, safe, danger]);

  const footer = useMemo(
    () => (
      <VStack pb={`${insets.bottom}px`} mt="8">
        <Divider />
        <Pressable onPress={linkToGoPlus}>
          <HStack alignItems="center" justifyContent="center" mt="4">
            <Typography.Body2 color="text-subdued">Powered By</Typography.Body2>
            <Image size="20px" source={goPlus} ml="2" mr="1" />
            <Typography.Body2>Go Plus</Typography.Body2>
          </HStack>
        </Pressable>
      </VStack>
    ),
    [insets.bottom, linkToGoPlus],
  );

  const renderItem = useCallback(
    ({ item }: { item: keyof GoPlusTokenSecurity }) => {
      const isWarnItem = warn.includes(item);
      let locale =
        tokenSecurityRiskItems[item]?.[hasSecurity ? 'danger' : 'safe'];
      const warnLocale = tokenSecurityRiskItems[item]?.warn;
      if (isWarnItem && warnLocale) {
        locale = warnLocale;
      }
      if (!locale) {
        return null;
      }
      let icon = <Icon size={20} name="BadgeCheckMini" color="icon-success" />;
      if (hasSecurity) {
        if (isWarnItem) {
          icon = (
            <Icon size={20} name="ExclamationCircleMini" color="icon-subdued" />
          );
        } else {
          icon = (
            <Icon
              size={20}
              name="ExclamationTriangleMini"
              color="icon-warning"
            />
          );
        }
      }
      return (
        <HStack
          mt={hasSecurity ? 4 : 0}
          mb={hasSecurity ? 0 : 4}
          alignItems="flex-start"
          w="full"
        >
          {icon}
          <VStack ml="3" flex="1">
            <Typography.Body1Strong>
              {intl.formatMessage(
                {
                  id:
                    typeof locale?.[0] === 'string'
                      ? locale?.[0]
                      : locale?.[0]?.[0],
                },
                locale?.[0]?.[1] ?? {},
              )}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage(
                {
                  id:
                    typeof locale?.[1] === 'string'
                      ? locale?.[1]
                      : locale?.[1][0],
                },
                locale?.[1]?.[1] ?? {},
              )}
            </Typography.Body2>
          </VStack>
        </HStack>
      );
    },
    [intl, hasSecurity, warn],
  );

  const groupListData = useMemo(
    () => [
      {
        headerProps: {
          title: intl.formatMessage(
            { id: 'form__str_risky_item_uppercase' },
            { 0: danger?.length ?? 0 },
          ),
        },
        data: danger,
      },
      {
        headerProps: {
          title: intl.formatMessage(
            { id: 'form__str_attention_item_uppercase' },
            { 0: warn?.length ?? 0 },
          ),
        },
        data: warn,
      },
    ],
    [danger, intl, warn],
  );

  const items = useMemo(() => {
    if (isSingleList) {
      if (!hasSecurity) {
        return safe;
      }
      if (!danger?.length) {
        return warn;
      }
      return danger;
    }
    return groupListData;
  }, [isSingleList, groupListData, safe, warn, danger, hasSecurity]);

  if (loading) {
    return (
      <Modal height="560px" hidePrimaryAction hideSecondaryAction footer={null}>
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      </Modal>
    );
  }

  return (
    <Modal height="560px" hidePrimaryAction hideSecondaryAction footer={null}>
      {!isSingleList ? (
        <GroupingList
          ListHeaderComponent={() => header}
          stickySectionHeadersEnabled={false}
          sections={items as typeof groupListData}
          // @ts-ignore
          renderItem={renderItem}
          keyExtractor={(item: string, index) => `${item}_${index}`}
          ListFooterComponent={() => footer}
          paddingX="2"
        />
      ) : (
        <List
          ListHeaderComponent={() => header}
          data={items as (keyof GoPlusTokenSecurity)[]}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item as string}_${index}`}
          ListFooterComponent={() => footer}
          paddingX="2"
        />
      )}
    </Modal>
  );
};

export default RiskDetail;
