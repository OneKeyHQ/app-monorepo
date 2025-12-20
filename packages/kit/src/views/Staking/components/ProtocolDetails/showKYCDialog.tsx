import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState, IKeyOfIcons } from '@onekeyhq/components';
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
import type { IDialogProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnActivateActionIcon,
  IEarnClaimWithKycActionIcon,
  IEarnConfirmDialogData,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';

type IClaimWithKycData = NonNullable<IEarnClaimWithKycActionIcon['data']>;

interface IGenericDialogContentProps {
  data: IEarnConfirmDialogData;
  onConfirm?: () => Promise<void>;
  confirmText?: string;
  // For link/close button types (from ClaimWithKycDialog)
  linkButton?: IClaimWithKycData['button'];
}

function GenericDialogContent({
  data,
  onConfirm,
  confirmText,
  linkButton,
}: IGenericDialogContentProps) {
  const intl = useIntl();
  const hasCheckboxes =
    Array.isArray(data.checkboxes) && data.checkboxes.length > 0;

  const [checkboxStates, setCheckboxStates] = useState<ICheckedState[]>(
    hasCheckboxes ? (data.checkboxes ?? []).map(() => false) : [],
  );

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
        if (onConfirm) {
          onConfirm()
            .then(() => resolve())
            .catch(() => reject());
        } else {
          resolve();
        }
      }),
    [onConfirm],
  );

  // Handle link button press (for ClaimWithKyc scenarios)
  const handleLinkPress = useCallback(() => {
    if (linkButton?.type === 'link') {
      if (linkButton.data?.showIntercom) {
        void showIntercom();
        return;
      }
      if (linkButton.data?.link) {
        void openUrlExternal(linkButton.data.link);
      }
    }
  }, [linkButton]);

  const isConfirmDisabled = hasCheckboxes
    ? checkboxStates.some((state) => !state)
    : false;

  const buttonText =
    confirmText ||
    data.button?.text?.text ||
    intl.formatMessage({
      id: ETranslations.global_confirm,
    });

  // Render footer based on button type
  const renderFooter = () => {
    // Link button type
    if (linkButton?.type === 'link') {
      return (
        <Dialog.Footer
          onConfirm={handleLinkPress}
          onConfirmText={linkButton.text?.text || ''}
          confirmButtonProps={{
            icon: linkButton.icon?.icon,
            disabled: Boolean(linkButton.disabled),
          }}
          showCancelButton={false}
        />
      );
    }

    // Close button type
    if (linkButton?.type === 'close') {
      return (
        <Dialog.Footer
          onCancelText={linkButton.text?.text || ''}
          cancelButtonProps={{
            disabled: Boolean(linkButton.disabled),
          }}
          showConfirmButton={false}
        />
      );
    }

    // Default confirm button
    return (
      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={buttonText}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
        showCancelButton={false}
      />
    );
  };

  return (
    <YStack gap="$2">
      {/* Description sections */}
      {data.description?.map((desc, index) => (
        <EarnText key={index} text={desc} fontSize="$bodyMd" />
      ))}

      {/* Accordions */}
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
      {hasCheckboxes ? (
        <YStack gap="$3">
          {(data.checkboxes ?? []).map((checkbox, index) => (
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
      ) : null}

      {renderFooter()}
    </YStack>
  );
}

export interface IShowConfirmDialogParams {
  data: IEarnConfirmDialogData;
  onConfirm?: () => Promise<void>;
  onClose?: () => void;
  confirmText?: string;
  icon?: IKeyOfIcons;
  tone?: IDialogProps['tone'];
  linkButton?: IClaimWithKycData['button'];
}

export function showConfirmDialog({
  data,
  onConfirm,
  onClose,
  confirmText,
  icon = 'InfoCircleOutline',
  tone,
  linkButton,
}: IShowConfirmDialogParams) {
  return Dialog.show({
    icon,
    title: data.title.text,
    showFooter: false,
    tone,
    onClose,
    renderContent: (
      <GenericDialogContent
        data={data}
        onConfirm={onConfirm}
        confirmText={confirmText}
        linkButton={linkButton}
      />
    ),
  });
}

export async function showConfirmDialogAsync({
  data,
  confirmText,
  icon = 'InfoCircleOutline',
  tone,
}: Omit<
  IShowConfirmDialogParams,
  'onConfirm' | 'onClose' | 'linkButton'
>): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = Dialog.show({
      icon,
      title: data.title.text,
      showFooter: false,
      tone,
      onClose: () => resolve(confirmed),
      renderContent: (
        <GenericDialogContent
          data={data}
          confirmText={confirmText}
          onConfirm={async () => {
            confirmed = true;
            await dialog.close();
          }}
        />
      ),
    });
  });
}

export function showClaimWithKycDialog({
  actionData,
}: {
  actionData: IEarnClaimWithKycActionIcon;
}) {
  const data = actionData.data;
  if (!data) return undefined;

  return showConfirmDialog({
    data: {
      title: data.title ?? { text: '' },
      description: data.description ?? [],
    },
    icon: data.icon?.icon,
    tone: data.tone,
    linkButton: data.button,
  });
}

function KYCDialogContent({
  data,
  onConfirm,
}: {
  data: IEarnActivateActionIcon['data'];
  onConfirm: (checkboxStates: boolean[]) => Promise<void>;
}) {
  const checkboxes = data.checkboxes ?? [];

  const [checkboxStates, setCheckboxStates] = useState<ICheckedState[]>(
    checkboxes.map(() => false),
  );

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

      {checkboxes.length > 0 ? (
        <YStack gap="$3">
          {checkboxes.map((checkbox, index) => (
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
      ) : null}

      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={data.button?.text?.text || ''}
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
