import { useEffect, useState } from 'react';

import natsort from 'natsort';
import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Form,
  Input,
  Select,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { v4CoinTypeToNetworkId } from '@onekeyhq/shared/src/consts/v4CoinTypeToNetworkId';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { buildChangeHistoryInputAddon } from '../ChangeHistoryDialog/ChangeHistoryDialog';
import { NetworkAvatar } from '../NetworkAvatar';

import { MAX_LENGTH_ACCOUNT_NAME } from './renameConsts';

import type { IntlShape } from 'react-intl';

type INameHistoryInfo = {
  entityId: string;
  entityType: EChangeHistoryEntityType;
  contentType: EChangeHistoryContentType.Name;
};

function useDeferredRenameInputEnhancements(deferEnhancements?: boolean) {
  const [shouldRenderEnhancements, setShouldRenderEnhancements] =
    useState(!deferEnhancements);

  useEffect(() => {
    if (!deferEnhancements) {
      setShouldRenderEnhancements(true);
      return;
    }

    if (typeof requestAnimationFrame === 'function') {
      const frameId = requestAnimationFrame(() => {
        setShouldRenderEnhancements(true);
      });
      return () => {
        cancelAnimationFrame(frameId);
      };
    }

    const timer = setTimeout(() => {
      setShouldRenderEnhancements(true);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [deferEnhancements]);

  return shouldRenderEnhancements;
}

function V4AccountNameSelector({
  onChange,
  indexedAccount,
}: {
  onChange?: (val: string) => void;
  indexedAccount: IDBIndexedAccount;
}) {
  const intl = useIntl();
  const [val] = useState('');
  const { result: items = [] } = usePromiseResult(async () => {
    const { accounts } =
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: indexedAccount.id,
        },
      );
    return accounts
      .map((account) => {
        const networkId = v4CoinTypeToNetworkId[account.coinType];
        const item: ISelectItem & {
          networkId?: string;
        } = {
          label: account.name,
          value: account.name,
          leading: <NetworkAvatar networkId={networkId} />,
          networkId,
        };
        return item;
      })
      .toSorted((a, b) =>
        natsort({ insensitive: true })(a.networkId || '', b.networkId || ''),
      );
  }, [indexedAccount.id]);

  return (
    <Stack pt="$2">
      <Select
        testID="rename-dialog-item-select"
        sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
        floatingPanelProps={{
          maxHeight: 272,
        }}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        renderTrigger={({ value, label, placeholder }) => (
          <Button
            testID="rename-dialog-item-btn"
            size="small"
            alignSelf="flex-start"
            variant="tertiary"
            iconAfter="ChevronDownSmallOutline"
          >
            {intl.formatMessage({
              id: ETranslations.v4_select_account_name_label,
            })}
          </Button>
        )}
        items={items}
        value={val}
        onChange={onChange}
        title={intl.formatMessage({
          id: ETranslations.v4_select_account_name_label,
        })}
      />
    </Stack>
  );
}

function V4AccountNameSelectorContainer({
  onChange,
  indexedAccount,
}: {
  onChange?: (val: string) => void;
  indexedAccount: IDBIndexedAccount;
}) {
  const { result: shouldShowV4AccountNameSelector } =
    usePromiseResult(async () => {
      return backgroundApiProxy.serviceV4Migration.canRenameFromV4AccountName({
        indexedAccount,
      });
    }, [indexedAccount]);

  return shouldShowV4AccountNameSelector ? (
    <V4AccountNameSelector
      indexedAccount={indexedAccount}
      onChange={onChange}
    />
  ) : null;
}

export function RenameInputWithNameSelector({
  value,
  onChange,
  maxLength = 8000,
  description,
  indexedAccount,
  disabledMaxLengthLabel = false,
  nameHistoryInfo,
  inputTestID,
  deferEnhancements,
}: {
  maxLength?: number;
  value?: string;
  onChange?: (val: string) => void;
  description?: string;
  indexedAccount?: IDBIndexedAccount;
  disabledMaxLengthLabel: boolean;
  nameHistoryInfo?: INameHistoryInfo;
  inputTestID?: string;
  deferEnhancements?: boolean;
}) {
  const intl = useIntl();
  const shouldRenderEnhancements =
    useDeferredRenameInputEnhancements(deferEnhancements);

  return (
    <>
      <Stack>
        <Input
          testID={inputTestID}
          size="large"
          $gtMd={{ size: 'medium' }}
          maxLength={maxLength}
          autoFocus
          value={value}
          onChangeText={onChange}
          flex={1}
          addOns={
            shouldRenderEnhancements && nameHistoryInfo?.entityId
              ? [
                  buildChangeHistoryInputAddon({
                    changeHistoryInfo: nameHistoryInfo,
                    onChange,
                  }),
                ]
              : undefined
          }
        />
        {shouldRenderEnhancements && indexedAccount ? (
          <V4AccountNameSelectorContainer
            indexedAccount={indexedAccount}
            onChange={onChange}
          />
        ) : null}
      </Stack>
      <Form.FieldDescription>
        {intl.formatMessage({
          id: ETranslations.account_name_form_helper_text,
        })}
      </Form.FieldDescription>
      {disabledMaxLengthLabel ? null : (
        <Form.FieldDescription textAlign="right">{`${value?.length || 0}/${
          maxLength ?? ''
        }`}</Form.FieldDescription>
      )}
      {description ? (
        <Form.FieldDescription>{description}</Form.FieldDescription>
      ) : null}
    </>
  );
}

export const showRenameDialog = (
  name: string,
  {
    onSubmit,
    maxLength = MAX_LENGTH_ACCOUNT_NAME,
    indexedAccount,
    disabledMaxLengthLabel = false,
    nameHistoryInfo,
    inputTestID,
    confirmTestID,
    intl,
    ...dialogProps
  }: IDialogShowProps & {
    indexedAccount?: IDBIndexedAccount;
    maxLength?: number;
    onSubmit: (name: string) => Promise<void>;
    disabledMaxLengthLabel?: boolean;
    nameHistoryInfo?: INameHistoryInfo;
    inputTestID?: string;
    confirmTestID?: string;
    intl: IntlShape;
  },
) =>
  Dialog.show({
    title: intl.formatMessage({ id: ETranslations.global_rename }),
    renderContent: (
      <Dialog.Form formProps={{ values: { name } }}>
        <Dialog.FormField
          name="name"
          rules={{
            required: {
              value: true,
              message: intl.formatMessage({
                id: ETranslations.form_rename_error_empty,
              }),
            },
            validate: (value: string) => {
              if (!value?.trim()) {
                return intl.formatMessage({
                  id: ETranslations.form_rename_error_empty,
                });
              }
              return true;
            },
          }}
        >
          <RenameInputWithNameSelector
            maxLength={maxLength}
            indexedAccount={indexedAccount}
            disabledMaxLengthLabel={disabledMaxLengthLabel}
            nameHistoryInfo={nameHistoryInfo}
            inputTestID={inputTestID}
            deferEnhancements
          />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      await onSubmit(form?.getValues().name);
      // fix toast dropped frames
      await close();
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_change_saved,
        }),
      });
    },
    ...dialogProps,
    ...(confirmTestID
      ? {
          confirmButtonProps: {
            ...dialogProps.confirmButtonProps,
            testID: confirmTestID,
          },
        }
      : {}),
  });
