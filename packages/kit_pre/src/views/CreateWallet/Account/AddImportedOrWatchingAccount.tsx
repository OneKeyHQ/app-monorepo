import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, ToastManager, useForm } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useGeneral, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddImportedOrWatchingAccountModal
>;

type AddImportedOrWatchingAccountValues = {
  name: string;
  importAs: number; // A segmented control value.
  networkId: string;
  template: string;
};

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const inputCategories = [
  UserInputCategory.IMPORTED,
  UserInputCategory.WATCHING,
];

const AddImportedOrWatchingAccount = () => {
  const intl = useIntl();

  const navigation = useNavigation<NavigationProps['navigation']>();

  const { control, handleSubmit, getValues, watch } =
    useForm<AddImportedOrWatchingAccountValues>();
  const {
    params: { text, checkResults, onSuccess, defaultName },
  } = useRoute<RouteProps>();

  const { activeNetworkId } = useGeneral();
  const { wallets } = useRuntime();

  const selectableNetworks = useMemo(
    () => [
      ...new Set(
        checkResults.reduce(
          (networks: Array<string>, result) =>
            networks.concat(result.possibleNetworks || []),
          [],
        ),
      ),
    ],
    [checkResults],
  );
  const watchNetwork = watch(
    'networkId',
    activeNetworkId && selectableNetworks.includes(activeNetworkId)
      ? activeNetworkId
      : selectableNetworks[0],
  );
  const possibleAddTypes = useMemo(
    () =>
      checkResults
        .filter(({ possibleNetworks = [] }) =>
          possibleNetworks.includes(watchNetwork),
        )
        .map(({ category }) => category),
    [watchNetwork, checkResults],
  );

  const derivationOptions = useMemo(() => {
    const options = checkResults.find((r) =>
      r.possibleNetworks?.includes(watchNetwork),
    )?.derivationOptions;
    if (!options || !options.length) return [];
    const ret = [];
    for (const value of options) {
      let label = '';
      if (typeof value.label === 'string') {
        label = value.label;
      } else if (typeof value.label === 'object') {
        label = intl.formatMessage({ id: value.label?.id });
      }
      let description;
      if (typeof value.desc === 'string') {
        description = value.desc;
      } else if (typeof value.desc === 'object') {
        description = intl.formatMessage(
          { id: value.desc?.id },
          value.desc?.placeholder,
        );
      }
      ret.push({
        label,
        value: value.template,
        description,
      });
    }
    return ret;
  }, [watchNetwork, checkResults, intl]);

  const defaultDerivationValue = useMemo(() => {
    if (!derivationOptions.length) return '';
    return derivationOptions[0].value;
  }, [derivationOptions]);

  const defaultAccountNames = useMemo(() => {
    const typeToNextIdMap = Object.fromEntries(
      wallets
        .filter((wallet) => ['imported', 'watching'].includes(wallet.type))
        .map((wallet) => [wallet.type, wallet.nextAccountIds.global || '']),
    );
    return [
      typeToNextIdMap.imported ? `Account #${typeToNextIdMap.imported}` : '',
      typeToNextIdMap.watching ? `Account #${typeToNextIdMap.watching}` : '',
    ];
  }, [wallets]);

  const importTypeIndex = useMemo(
    () => getValues('importAs') ?? inputCategories.indexOf(possibleAddTypes[0]),
    [getValues, possibleAddTypes],
  );

  const onFailure = useCallback(() => {
    const stack = navigation.getParent() || navigation;
    if (stack.canGoBack()) {
      stack.goBack();
    }
  }, [navigation]);

  const onSubmit = useCallback(
    async (values: AddImportedOrWatchingAccountValues) => {
      const selectedTypeIndex =
        values.importAs ?? inputCategories.indexOf(possibleAddTypes[0]);
      const importType = inputCategories[selectedTypeIndex];
      const name =
        values.name || defaultName || defaultAccountNames[selectedTypeIndex];
      const template = values.template || defaultDerivationValue || undefined;

      if (importType === UserInputCategory.IMPORTED) {
        navigation.navigate(
          CreateWalletModalRoutes.AddImportedAccountDoneModal,
          {
            privatekey: text,
            networkId: values.networkId,
            name,
            template,
            onSuccess,
            onFailure,
          },
        );
      } else if (importType === UserInputCategory.WATCHING) {
        try {
          const accountAdded =
            await backgroundApiProxy.serviceAccount.addWatchAccount(
              values.networkId,
              text,
              name,
              template,
            );
          onSuccess?.({
            account: accountAdded,
          });
        } catch (e) {
          const errorKey = (e as { key: LocaleIds }).key;
          ToastManager.show({
            title: intl.formatMessage({ id: errorKey }),
          });
          onFailure?.();
        }
      }
    },
    [
      defaultName,
      possibleAddTypes,
      defaultAccountNames,
      navigation,
      text,
      onSuccess,
      onFailure,
      defaultDerivationValue,
      intl,
    ],
  );
  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({
        id:
          importTypeIndex === 0
            ? 'wallet__imported_accounts'
            : 'wallet__watched_accounts',
      })}
      primaryActionProps={{
        type: 'primary',
        onPromise: handleSubmit(onSubmit),
      }}
      primaryActionTranslationId="action__import"
      hideSecondaryAction
    >
      <Form>
        {selectableNetworks.length === 1 ? undefined : (
          <FormChainSelector
            selectableNetworks={selectableNetworks}
            control={control}
            name="networkId"
            hideHelpText
          />
        )}
        {possibleAddTypes.length === 1 ? undefined : (
          <Form.Item
            name="importAs"
            label={intl.formatMessage({ id: 'form__import_as' })}
            control={control}
          >
            <Form.SegmentedControl
              values={[
                intl.formatMessage({ id: 'wallet__imported_accounts' }),
                intl.formatMessage({ id: 'wallet__watched_accounts' }),
              ]}
            />
          </Form.Item>
        )}
        {derivationOptions.length <= 1 ? undefined : (
          <Form.Item
            name="template"
            label={intl.formatMessage({ id: 'form__address_type_label' })}
            control={control}
          >
            <Form.Select
              headerShown={false}
              footer={null}
              defaultValue={defaultDerivationValue}
              options={derivationOptions}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default AddImportedOrWatchingAccount;
