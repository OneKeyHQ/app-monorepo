import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Form,
  Icon,
  Input,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

function RewardCenterContent({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const form = useForm({
    defaultValues: {
      code: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  return (
    <Form form={form}>
      <Divider />
      <YStack gap="$4">
        <YStack gap="$2">
          <SizableText size="$headingLg">Subsidy</SizableText>
          <XStack alignItems="center" justifyContent="space-between">
            <SizableText size="$bodyLgMedium" color="$textSubdued">
              Remaining 286 / 1000
            </SizableText>
            <Button size="medium" variant="primary">
              Claim
            </Button>
          </XStack>
        </YStack>
        <YStack gap="$2">
          <SizableText size="$headingLg">Redeem</SizableText>
          <XStack alignItems="center" justifyContent="space-between">
            <Form.Field name="code">
              <Input placeholder="Enter redemption code" />
            </Form.Field>
            <Button size="medium" variant="primary">
              OK
            </Button>
          </XStack>
        </YStack>
      </YStack>
    </Form>
  );
}

export const showTronRewardCenter = ({
  accountId,
  networkId,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
}) =>
  Dialog.show({
    title: 'Subsidy/Redeem',
    tone: 'info',
    description: (
      <SizableText size="$bodyLg" color="$textSubdued">
        Subsidy valid for 10 mins, FCFS. Users can claim 15 free subsidies per
        month.
      </SizableText>
    ),
    icon: 'GiftSolid',
    renderContent: (
      <RewardCenterContent accountId={accountId} networkId={networkId} />
    ),
    showCancelButton: false,
    showConfirmButton: false,
    ...dialogProps,
  });
