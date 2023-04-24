import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  HStack,
  Text,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';

import { showOverlay } from '../../utils/overlayUtils';

import { BottomSheetSettings } from './BottomSheetSettings';

type Props = { title: string; content: string } & Pick<
  ModalProps,
  | 'hidePrimaryAction'
  | 'hideSecondaryAction'
  | 'secondaryActionTranslationId'
  | 'primaryActionTranslationId'
  | 'onSecondaryActionPress'
  | 'onPrimaryActionPress'
  | 'secondaryActionProps'
  | 'primaryActionProps'
  | 'onClose'
>;

const ManageTokenListingTip: FC<Props> = ({
  title,
  content,
  hidePrimaryAction,
  hideSecondaryAction,
  primaryActionTranslationId,
  secondaryActionTranslationId,
  onPrimaryActionPress,
  onSecondaryActionPress,
  secondaryActionProps,
  primaryActionProps,
  onClose,
}) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  return (
    <VStack pb={`${bottom}px`}>
      <Text fontWeight="700" fontSize="56px" textAlign="center" mb="3">
        ℹ️
      </Text>
      <Typography.DisplayMedium textAlign="center" mb="2">
        {title}
      </Typography.DisplayMedium>
      <Typography.Body2 textAlign="center" mb="8" color="text-subdued">
        {content}
      </Typography.Body2>
      <HStack alignItems="center" space="3" justifyContent="flex-end">
        {!hideSecondaryAction && (
          <Button
            flex={1}
            lineHeight="50px"
            size="xl"
            onPress={() => {
              onSecondaryActionPress?.({ close: () => onClose?.() });
              onClose?.();
            }}
            {...secondaryActionProps}
          >
            {secondaryActionProps?.children ??
              intl.formatMessage({
                id: secondaryActionTranslationId ?? 'action__cancel',
              })}
          </Button>
        )}
        {!hidePrimaryAction && (
          <Button
            flex={1}
            type="primary"
            lineHeight="50px"
            size="xl"
            onPress={() => {
              onPrimaryActionPress?.({ onClose, close: () => onClose?.() });
            }}
            {...primaryActionProps}
          >
            {primaryActionProps?.children ??
              intl.formatMessage({
                id: primaryActionTranslationId ?? 'action__ok',
              })}
          </Button>
        )}
      </HStack>
    </VStack>
  );
};
export const showManageTokenListingTip = (props: Props) =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <ManageTokenListingTip {...props} onClose={closeOverlay} />
    </BottomSheetSettings>
  ));
