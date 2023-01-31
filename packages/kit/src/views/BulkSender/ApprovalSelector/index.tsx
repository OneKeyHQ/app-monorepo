import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import * as overlayUtils from '../../../utils/overlayUtils';

function OptionItem({
  title,
  content,
  isChecked,
  isUnlimited,
  onSelected,
}: {
  title: string;
  content: string;
  isChecked: boolean;
  isUnlimited: boolean;
  onSelected: (isUnlimited: boolean) => void;
}) {
  return (
    <Pressable
      borderRadius={12}
      _hover={{
        bg: 'surface-hovered',
      }}
      _pressed={{
        bg: 'surface-pressed',
        borderColor: 'surface-pressed',
      }}
      paddingX={3}
      paddingY={2}
      marginX={-3}
      onPress={() => onSelected(isUnlimited)}
    >
      <HStack space={4} alignItems="center">
        <Box flex={1}>
          <Text typography="Body1Strong">{title}</Text>
          <Text typography="Body2" color="text-subdued">
            {content}
          </Text>
        </Box>
        <Box opacity={isChecked ? 1 : 0}>
          <Icon name="CheckMini" color="icon-success" />
        </Box>
      </HStack>
    </Pressable>
  );
}

function ApprovalSelectorBottomSheetModal({
  closeOverlay,
  isUnlimited,
  setIsUnlimited,
}: {
  closeOverlay: () => void;
  isUnlimited: boolean;
  setIsUnlimited: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  const approvalOptions = [
    {
      title: 'Amount of Token to Send',
      content:
        'Approve the amount of tokens to send. You will need to approve a new allowance again in the future.',
      isUnlimited: false,
    },
    {
      title: 'Unlimited',
      content:
        'You don’t need to approve again in the future which means will save you some gas.',
      isUnlimited: true,
    },
  ];

  const handleSelectApproval = useCallback(
    (u: boolean) => {
      setIsUnlimited(u);
      closeOverlay();
    },
    [closeOverlay, setIsUnlimited],
  );

  return (
    <BottomSheetModal
      closeOverlay={closeOverlay}
      showCloseButton={!isVertical}
      title="Approval"
    >
      <Box pb={isVertical ? 6 : 0}>
        {approvalOptions.map((option) => (
          <OptionItem
            key={option.title}
            isChecked={isUnlimited === option.isUnlimited}
            title={option.title}
            content={option.content}
            isUnlimited={option.isUnlimited}
            onSelected={handleSelectApproval}
          />
        ))}
        <Button type="primary" size="xl" mt={6} onPress={closeOverlay}>
          {intl.formatMessage({ id: 'action__done' })}
        </Button>
      </Box>
    </BottomSheetModal>
  );
}

const showApprovalSelector = ({
  isUnlimited,
  setIsUnlimited,
}: {
  isUnlimited: boolean;
  setIsUnlimited: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  overlayUtils.showOverlay((close) => (
    <ApprovalSelectorBottomSheetModal
      isUnlimited={isUnlimited}
      setIsUnlimited={setIsUnlimited}
      closeOverlay={close}
    />
  ));
};

export { showApprovalSelector };
