import React, { FC, useCallback, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Address,
  Box,
  CheckBox,
  Divider,
  Modal,
  Typography,
} from '@onekeyhq/components';
import type { ImportableHDAccount } from '@onekeyhq/engine/src/types/account';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { deviceUtils } from '../../../utils/hardware';

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverAccountsConfirm
>;

type FlatDataType = ImportableHDAccount & {
  selected: boolean;
  isDisabled: boolean;
};
type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

const RecoverConfirm: FC = () => {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;

  const route = useRoute<RouteProps>();
  const { accounts, walletId, network, purpose, onLoadingAccount } =
    route.params;
  const [flatListData, updateFlatListData] = useState<FlatDataType[]>(accounts);
  const [isVaild, setIsVaild] = useState(true);
  const navigation = useNavigation<NavigationProps['navigation']>();

  const authenticationDone = async (password: string) => {
    try {
      const selectedIndexes = flatListData
        .filter((i) => i.selected)
        .map((i) => i.index);
      onLoadingAccount?.(walletId, network, false);
      await serviceAccount.addHDAccounts(
        password,
        walletId,
        network,
        selectedIndexes,
        undefined,
        purpose,
      );
    } catch (e: any) {
      deviceUtils.showErrorToast(e, 'action__connection_timeout');
    } finally {
      onLoadingAccount?.(walletId, network, true);
    }

    if (navigation?.canGoBack?.()) {
      navigation?.getParent?.()?.goBack?.();
    }
  };
  const selectAllHandle = () => {
    const selectCount = flatListData.filter((i) => i.selected).length;
    updateFlatListData((prev) =>
      prev.map((i) => {
        i.selected = !(selectCount === flatListData.length);
        return i;
      }),
    );
    setIsVaild(!(selectCount === flatListData.length));
  };
  const header = () => {
    const selectCount = flatListData.filter((i) => i.selected).length;
    return (
      <Box flexDirection="column" height="76px">
        <Box
          flexDirection="row"
          pl="16px"
          alignItems="center"
          bgColor="surface-default"
          flex={1}
        >
          <Box>
            <CheckBox
              isChecked={selectCount > 0}
              defaultIsChecked={
                selectCount > 0 && selectCount < flatListData.length
              }
              onChange={selectAllHandle}
            />
          </Box>
          <Box>
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'form__select_all' })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'content__up_to_100_accounts' })}
            </Typography.Body2>
          </Box>
        </Box>
        <Divider />
      </Box>
    );
  };

  const checkBoxOnChange = (isSelected: boolean, item: FlatDataType) => {
    updateFlatListData((prev) =>
      prev.map((i) => {
        if (i.path === item.path) {
          i.selected = isSelected;
        }
        return i;
      }),
    );
    setIsVaild(flatListData.filter((i) => i.selected).length > 0);
  };

  const renderItem: ListRenderItem<FlatDataType> = useCallback(
    ({ item, index }) => (
      <Box
        flexDirection="row"
        paddingX="16px"
        bgColor="surface-default"
        alignItems="center"
        height="52px"
        borderBottomRadius={index === flatListData.length - 1 ? '12px' : 0}
      >
        <Box>
          <CheckBox
            isChecked={item.selected}
            isDisabled={item.isDisabled}
            onChange={(isSelected) => {
              checkBoxOnChange(isSelected, item);
            }}
          />
        </Box>
        <Box flexDirection="row" flex={1} justifyContent="space-between">
          <Typography.Body2Strong>
            {`${item.defaultName}`}
          </Typography.Body2Strong>
          <Address
            typography="Body2"
            color="text-subdued"
            text={item.displayAddress}
            short
          />
        </Box>
      </Box>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flatListData],
  );

  return (
    <Modal
      height="640px"
      header={intl.formatMessage({ id: 'action__recover_accounts' })}
      headerDescription={`${intl.formatMessage({
        id: 'account__recover_2_of_2',
      })}`}
      primaryActionTranslationId="action__recover"
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateAccount,
          params: {
            screen:
              CreateAccountModalRoutes.RecoverAccountsConfirmAuthentication,
            params: {
              walletId,
              onDone: authenticationDone,
            },
          },
        });
      }}
      primaryActionProps={{
        isDisabled: !isVaild,
      }}
      hideSecondaryAction
      flatListProps={{
        height: '640px',
        data: flatListData,
        // @ts-ignore
        renderItem,
        ItemSeparatorComponent: () => <Divider />,
        keyExtractor: (item) => (item as ImportableHDAccount).path,
        ListHeaderComponent: header,
      }}
      mt="10px"
    />
  );
};

export default RecoverConfirm;
