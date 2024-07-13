import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Form,
  Input,
  Page,
  SizableText,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  from: string;
  count: string;
};

function BatchCreateAccountFormPage({ walletId }: { walletId: string }) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();

  const intl = useIntl();
  const media = useMedia();

  const form = useForm<IFormValues>({
    values: {
      networkId: activeAccount?.network?.id ?? getNetworkIdsMap().btc,
      deriveType: activeAccount?.deriveType ?? 'default',
      from: '1',
      count: '50',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const networkIdValue = form.watch('networkId');

  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header />
      <Page.Body p="$4">
        <SizableText>walletId: {walletId}</SizableText>
        <SizableText>networkId: {activeAccount.network?.id}</SizableText>
        <SizableText>deriveType: {activeAccount.deriveType}</SizableText>
        <SizableText>
          {intl.formatMessage(
            {
              id: ETranslationsMock.batch_create_account_preview_added,
            },
            {
              count: '12',
            },
          )}
        </SizableText>

        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_network })}
            name="networkId"
          >
            <ControlledNetworkSelectorTrigger />
          </Form.Field>

          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.derivation_path,
            })}
            name="deriveType"
          >
            <DeriveTypeSelectorTriggerStaticInput
              networkId={networkIdValue || ''}
              defaultTriggerInputProps={{
                size: media.gtMd ? 'medium' : 'large',
              }}
            />
          </Form.Field>

          <Form.Field
            label={intl.formatMessage({
              id: ETranslationsMock.batch_create_account_from,
            })}
            name="from"
          >
            <Input
              secureTextEntry={false}
              placeholder={intl.formatMessage({
                id: ETranslationsMock.batch_create_account_from,
              })}
              size={media.gtMd ? 'medium' : 'large'}
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslationsMock.batch_create_account_count,
            })}
            name="count"
          >
            <Input
              secureTextEntry={false}
              placeholder={intl.formatMessage({
                id: ETranslationsMock.batch_create_account_count,
              })}
              size={media.gtMd ? 'medium' : 'large'}
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslationsMock.batch_create_account_preview,
        })}
        confirmButtonProps={{
          disabled: false,
        }}
        onConfirm={async () => {
          await form.handleSubmit(async (values) => {
            console.log(values);
            navigation.navigate(
              EAccountManagerStacksRoutes.BatchCreateAccountPreview,
              {
                walletId,
                networkId: values.networkId,
                from: values.from,
                count: values.count,
              },
            );
          })();
        }}
      />
    </Page>
  );
}

export default function BatchCreateAccountForm({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.BatchCreateAccountForm
>) {
  const { walletId } = route.params ?? {};
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <BatchCreateAccountFormPage walletId={walletId} />
    </AccountSelectorProviderMirror>
  );
}
