import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  BottomSheetModal,
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';

type ApprovalOption = {
  title: string;
  subtitle?: string;
  content: string;
  isUnlimited: boolean;
};

function OptionItem({
  option,
  isChecked,
  onSelected,
  isAlreadyUnlimited,
}: {
  option: ApprovalOption;
  isChecked: boolean;
  onSelected: (isUnlimited: boolean) => void;
  isAlreadyUnlimited: boolean;
}) {
  const { title, subtitle, content, isUnlimited } = option;

  const intl = useIntl();

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
          {subtitle ? (
            <HStack space={2}>
              <Text typography="Body1Strong">{title}</Text>
              <Badge title={subtitle} size="sm" />
              {isAlreadyUnlimited && isChecked && (
                <Badge
                  title={intl.formatMessage({ id: 'form__approved' })}
                  size="sm"
                  color="text-success"
                  bgColor="surface-success-default"
                />
              )}
            </HStack>
          ) : (
            <HStack space={2}>
              <Text typography="Body1Strong">{title}</Text>
              {isAlreadyUnlimited && isChecked && (
                <Badge
                  title={intl.formatMessage({ id: 'form__approved' })}
                  size="sm"
                  color="text-success"
                  bgColor="surface-success-default"
                />
              )}
            </HStack>
          )}
          <Text typography="Body2" color="text-subdued" lineHeight="20px">
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
  isAlreadyUnlimited,
}: {
  closeOverlay: () => void;
  isUnlimited: boolean;
  setIsUnlimited: React.Dispatch<React.SetStateAction<boolean>>;
  isAlreadyUnlimited: boolean;
}) {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  const approvalOptions: ApprovalOption[] = [
    {
      title: intl.formatMessage({ id: 'form__exact_amount' }),
      subtitle: intl.formatMessage({ id: 'content__safer' }),
      content: intl.formatMessage({
        id: 'content__approve_the_amount_to_tokens_to_be_sent',
      }),
      isUnlimited: false,
    },
    {
      title: intl.formatMessage({ id: 'form__unlimited' }),
      content: intl.formatMessage({
        id: 'content__you_dont_need _to_approve_again_in_the_future',
      }),
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
      title={intl.formatMessage({ id: 'title__approval' })}
    >
      <Box pb={isVertical ? 6 : 0}>
        {approvalOptions.map((option) => (
          <OptionItem
            key={option.title}
            isChecked={isUnlimited === option.isUnlimited}
            option={option}
            onSelected={handleSelectApproval}
            isAlreadyUnlimited={isAlreadyUnlimited}
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
  isAlreadyUnlimited,
}: {
  isUnlimited: boolean;
  setIsUnlimited: React.Dispatch<React.SetStateAction<boolean>>;
  isAlreadyUnlimited: boolean;
}) => {
  showOverlay((close) => (
    <ApprovalSelectorBottomSheetModal
      isUnlimited={isUnlimited}
      setIsUnlimited={setIsUnlimited}
      isAlreadyUnlimited={isAlreadyUnlimited}
      closeOverlay={close}
    />
  ));
};

export { showApprovalSelector };
