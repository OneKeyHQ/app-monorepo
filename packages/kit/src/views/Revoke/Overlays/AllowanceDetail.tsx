import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  HStack,
  Icon,
  Pressable,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../../Overlay/AccountValueSettings';
import { RevokeRoutes } from '../types';

export type ActionKey = 'share' | 'copy' | 'change' | 'revoke';

type Props = {
  spenderName: string;
  allowance: string;
  onActionPress: (key: ActionKey) => void;
  disabledActions?: ActionKey[];
};

const actions: { icon: any; key: ActionKey; label: any }[] = [
  {
    icon: 'PaperAirplaneSolid',
    key: 'share',
    label: 'title__share',
  },
  {
    icon: 'DuplicateOutline',
    key: 'copy',
    label: 'action__copy_contract_address',
  },
  {
    icon: 'PencilAltSolid',
    key: 'change',
    label: 'action__change_allowance',
  },
  {
    icon: 'CloseOutline',
    key: 'revoke',
    label: 'action__revoke',
  },
];

const AllowanceDetail: FC<
  Props & {
    closeOverlay: () => void;
  }
> = ({
  spenderName,
  allowance,
  closeOverlay,
  onActionPress,
  disabledActions,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const handlePress = useCallback(
    (key: ActionKey) => {
      closeOverlay();
      if (key === 'share') {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Revoke,
          params: {
            screen: RevokeRoutes.ShareModal,
          },
        });
      } else {
        onActionPress(key);
      }
    },
    [closeOverlay, onActionPress, navigation],
  );
  return (
    <VStack pb={`${insets.bottom}px`}>
      <Typography.Heading textAlign="center" mb="2">
        {spenderName}
      </Typography.Heading>
      <Typography.Body2 textAlign="center" mb="4">
        {allowance}
      </Typography.Body2>
      <Divider h="1px" />

      {actions
        .filter((a) => !disabledActions?.includes(a.key))
        .map((a) => (
          <Pressable onPress={() => handlePress(a.key)} key={a.key} mt="6">
            <HStack>
              <Icon
                size={24}
                name={a.icon}
                color={a.key === 'revoke' ? 'icon-critical' : 'icon-default'}
              />
              <Typography.Body1
                ml="4"
                color={a.key === 'revoke' ? 'icon-critical' : 'text-default'}
              >
                {intl.formatMessage({ id: a.label })}
              </Typography.Body1>
            </HStack>
          </Pressable>
        ))}
    </VStack>
  );
};

const showAllowanceDetailOverlay = (props: Props) => {
  showOverlay((closeOverlay) => (
    <BottomSheetSettings
      closeOverlay={closeOverlay}
      titleI18nKey="content__details"
    >
      <AllowanceDetail {...props} closeOverlay={closeOverlay} />
    </BottomSheetSettings>
  ));
};
export default showAllowanceDetailOverlay;
