import { useCallback, useMemo, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnActivateActionIcon,
  IEarnClaimWithKycActionIcon,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';

function KYCDialogContent({
  data,
  onConfirm,
}: {
  data: IEarnActivateActionIcon['data'];
  onConfirm: (checkboxStates: boolean[]) => Promise<void>;
}) {
  // Initialize checkbox states for all checkbox
  const [checkboxStates, setCheckboxStates] = useState<ICheckedState[]>(
    data.checkboxes.map(() => false),
  );

  // Initialize accordion expand states
  const [expandedItems, setExpandedItems] = useState<boolean[]>(
    data.accordions?.map(() => false) || [],
  );

  const handleCheckboxChange = useCallback(
    (index: number) => (value: ICheckedState) => {
      setCheckboxStates((prev) =>
        prev.map((state, i) => (i === index ? value : state)),
      );
    },
    [],
  );

  const toggleExpandedItem = useCallback((index: number) => {
    setExpandedItems((prev) =>
      prev.map((expanded, i) => (i === index ? !expanded : expanded)),
    );
  }, []);

  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        // Convert ICheckedState to boolean for onConfirm callback
        const booleanStates = checkboxStates.map((state) => Boolean(state));
        onConfirm(booleanStates)
          .then(() => resolve())
          .catch(() => reject());
      }),
    [checkboxStates, onConfirm],
  );

  const isConfirmDisabled = checkboxStates.some((state) => !state);

  return (
    <YStack gap="$2">
      {/* Description sections */}
      {data.description.map((desc, index) => (
        <EarnText key={index} text={desc} fontSize="$bodyMd" />
      ))}

      {Array.isArray(data.accordions) && data.accordions.length > 0 ? (
        <YStack gap="$2">
          {data.accordions.map(({ title, description }, index) => (
            <YStack key={String(index)}>
              <Button
                variant="secondary"
                size="small"
                onPress={() => toggleExpandedItem(index)}
                px="$2"
                py="$1"
                mx="$-2"
                // my="$-1"
                bg="$transparent"
                borderWidth={0}
                borderRadius="$2"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                justifyContent="space-between"
                alignItems="center"
                flexDirection="row"
              >
                <XStack alignItems="center" gap="$1">
                  <SizableText
                    textAlign="left"
                    size="$bodyMd"
                    color={expandedItems[index] ? '$text' : '$textSubdued'}
                  >
                    {title.text}
                  </SizableText>
                  <Stack rotate={expandedItems[index] ? '180deg' : '0deg'}>
                    <Icon
                      name="ChevronDownSmallOutline"
                      color={
                        expandedItems[index] ? '$iconActive' : '$iconSubdued'
                      }
                      size="$5"
                    />
                  </Stack>
                </XStack>
              </Button>
              {expandedItems[index] ? (
                <YStack pt="$2">
                  <EarnText
                    text={description}
                    size="$bodySm"
                    color="$textSubdued"
                  />
                </YStack>
              ) : null}
            </YStack>
          ))}
        </YStack>
      ) : null}

      {/* Checkboxes */}
      <YStack gap="$3">
        {data.checkboxes.map((checkbox, index) => (
          <XStack key={index} alignItems="flex-start" gap="$2">
            <Checkbox
              labelContainerProps={{
                flex: 1,
              }}
              label={checkbox.text}
              value={checkboxStates[index]}
              onChange={handleCheckboxChange(index)}
              labelProps={{
                variant: '$bodyMdMedium',
              }}
            />
          </XStack>
        ))}
      </YStack>

      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={data.button.text.text}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
        showCancelButton={false}
      />
    </YStack>
  );
}

export function showKYCDialog({
  actionData,
  onConfirm,
}: {
  actionData: IEarnActivateActionIcon;
  onConfirm: (checkboxStates: boolean[]) => Promise<void>;
}) {
  return Dialog.show({
    icon: 'PassportOutline',
    title: actionData.data.title.text,
    showFooter: false,
    renderContent: (
      <KYCDialogContent data={actionData.data} onConfirm={onConfirm} />
    ),
  });
}

function ClaimWithKycDialogContent({
  data,
}: {
  data: IEarnClaimWithKycActionIcon['data'];
}) {
  const button = useMemo(() => {
    if (data?.button?.type === 'link') {
      return data.button;
    }
    if (data?.button?.type === 'close') {
      return data.button;
    }
    return undefined;
  }, [data?.button]);

  const handleLinkPress = useCallback(() => {
    if (button?.type === 'link') {
      if (button.data?.showIntercom) {
        void showIntercom();
        return;
      }
      if (button.data?.link) {
        void openUrlExternal(button.data.link);
      }
    }
  }, [button]);

  const buttonText = useMemo(() => {
    if (typeof button?.text?.text === 'string') {
      return button.text.text;
    }
    return '';
  }, [button?.text?.text]);

  const isButtonDisabled = Boolean(button?.disabled);

  const renderFooter = () => {
    if (!button) {
      return null;
    }

    if (button.type === 'link') {
      return (
        <Dialog.Footer
          onConfirm={handleLinkPress}
          onConfirmText={buttonText}
          confirmButtonProps={{
            icon: button.icon?.icon,
            disabled: isButtonDisabled,
          }}
          showCancelButton={false}
        />
      );
    }

    if (button.type === 'close') {
      return (
        <Dialog.Footer
          onCancelText={buttonText}
          cancelButtonProps={{
            disabled: isButtonDisabled,
          }}
          showConfirmButton={false}
        />
      );
    }

    return null;
  };

  return (
    <YStack gap="$2">
      {data?.description?.map((desc, index) => (
        <EarnText key={index} text={desc} fontSize="$bodyMd" />
      ))}

      {renderFooter()}
    </YStack>
  );
}

export function showClaimWithKycDialog({
  actionData,
}: {
  actionData: IEarnClaimWithKycActionIcon;
}) {
  return Dialog.show({
    icon: actionData.data?.icon?.icon,
    title: actionData.data?.title?.text,
    showFooter: false,
    renderContent: <ClaimWithKycDialogContent data={actionData.data} />,
    tone: actionData.data?.tone,
  });
}
