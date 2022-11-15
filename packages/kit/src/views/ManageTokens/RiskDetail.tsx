import React, { FC, useCallback, useMemo } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
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
  Spinner,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { tokenSecurityRiskItems } from '@onekeyhq/engine/src/managers/goplus';
import { GoPlusTokenSecurity } from '@onekeyhq/engine/src/types/goplus';
import goPlus from '@onekeyhq/kit/assets/goPlus.png';
import NoRisks from '@onekeyhq/kit/assets/NoRisks.png';

import { useTokenSecurityInfo } from './hooks';
import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

type NavigationProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.TokenRiskDetail
>;

const RiskDetail: FC = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const {
    token: { networkId, address },
  } = route.params;
  const { loading, data } = useTokenSecurityInfo(networkId, address);

  const { safe, danger, hasSecurity, warn } = data;

  const header = useMemo(() => {
    if (hasSecurity) {
      return (
        <Center mt="6" mb="8">
          <Icon name="ShieldExclamationSolid" color="icon-critical" size={44} />
          <Typography.DisplayLarge mt="2">
            {intl.formatMessage({ id: 'title__risky_token' })}
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
        <Typography.Body1>
          {intl.formatMessage(
            { id: 'form__no_risks_desc' },
            { 0: safe?.length ?? 0 },
          )}
        </Typography.Body1>
      </Center>
    );
  }, [hasSecurity, intl, safe]);

  const footer = useMemo(
    () => (
      <HStack
        h="8"
        pt="4"
        mb="3"
        alignItems="flex-end"
        justifyContent="center"
        mx="4"
      >
        <Typography.Body2 color="text-subdued">Powered By</Typography.Body2>
        <Image size="20px" source={goPlus} ml="2" mr="1" />
        <Typography.Body2>Go Plus</Typography.Body2>
      </HStack>
    ),
    [],
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
      let icon = <Icon size={20} name="BadgeCheckSolid" color="icon-success" />;
      if (hasSecurity) {
        if (isWarnItem) {
          icon = (
            <Icon size={20} name="ExclamationSolid" color="icon-warning" />
          );
        } else {
          icon = (
            <Icon
              size={20}
              name="ShieldExclamationSolid"
              color="icon-critical"
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
            <Typography.Body2>
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
  const GroupingListData = useMemo(
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
    <Modal height="560px" hidePrimaryAction hideSecondaryAction footer={footer}>
      {hasSecurity ? (
        <GroupingList
          ListHeaderComponent={() => header}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={Divider}
          sections={GroupingListData}
          // @ts-ignore
          renderItem={renderItem}
          keyExtractor={(item: string, index) => `${item}_${index}`}
        />
      ) : (
        <List
          ListHeaderComponent={() => header}
          ItemSeparatorComponent={Divider}
          data={safe}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item as string}_${index}`}
        />
      )}
    </Modal>
  );
};

export default RiskDetail;
