import {
  type ComponentProps,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFormContext } from 'react-hook-form';
import { useIntl } from 'react-intl';

import type { TextArea } from '@onekeyhq/components';
import {
  ActionList,
  Badge,
  Icon,
  IconButton,
  Select,
  Spinner,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAddressBookPick } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAddressInteractionStatus } from '@onekeyhq/shared/types/address';

import useAppNavigation from '../../hooks/useAppNavigation';
import { BaseInput } from '../BaseInput';

type IAddressPluginsOptions = {
  clipboard?: boolean;
  scan?: boolean;
  contacts?: boolean;
};

type IAddressPluginProps = {
  onChange?: (text: string) => void;
  testID?: string;
};

const ClipboardPlugin: FC<IAddressPluginProps> = ({ onChange, testID }) => {
  const { getClipboard } = useClipboard();
  const onPress = useCallback(async () => {
    const text = await getClipboard();
    onChange?.(text);
  }, [onChange, getClipboard]);
  return (
    <IconButton
      title="Paste"
      variant="tertiary"
      icon="ClipboardOutline"
      onPress={onPress}
      testID={testID}
    />
  );
};

const ScanPlugin: FC<IAddressPluginProps> = ({ onChange, testID }) => {
  const { start } = useScanQrCode();
  const onPress = useCallback(async () => {
    const address = await start(false);
    onChange?.(address?.raw);
  }, [onChange, start]);
  return (
    <IconButton
      title="Scan"
      variant="tertiary"
      icon="ScanSolid"
      onPress={onPress}
      testID={testID}
    />
  );
};

const ScanPluginContainer: FC<IAddressPluginProps> = ({ onChange }) => (
  <AccountSelectorProviderMirror
    config={{
      sceneName: EAccountSelectorSceneName.home,
    }}
    enabledNum={[0]}
  >
    <ScanPlugin onChange={onChange} />
  </AccountSelectorProviderMirror>
);

type IContactsPluginProps = IAddressPluginProps & {
  networkId?: string;
};

const ContactsPlugin: FC<IContactsPluginProps> = ({
  onChange,
  networkId,
  testID,
}) => {
  const ref = useRef<boolean>(false);
  const pick = useAddressBookPick();
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({
    num: 0,
  });
  const onPress = useCallback(() => {
    void pick({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
      },
    });
  }, [onChange, pick, networkId]);
  useEffect(() => {
    if (account?.address && ref.current) {
      onChange?.(account?.address);
    }
  }, [account?.address, onChange]);
  return (
    <ActionList
      title="Select"
      items={[
        {
          icon: 'WalletCryptoOutline',
          label: 'My Accounts',
          onPress: () => {
            ref.current = true;
            void actions.current.showAccountSelector({
              activeWallet: wallet,
              num: 0,
              navigation,
              sceneName: EAccountSelectorSceneName.addressInput,
            });
          },
        },
        {
          icon: 'ContactsOutline',
          label: 'Address Book',
          onPress,
        },
      ]}
      renderTrigger={
        <IconButton
          title="Paste"
          variant="tertiary"
          icon="DotVerOutline"
          testID={testID}
        />
      }
    />
  );
};

type IResolvedAddressProps = {
  value: string;
  options: string[];
  onChange?: (value: string) => void;
};

const ResolvedAddress: FC<IResolvedAddressProps> = ({
  value,
  options,
  onChange,
}) => {
  if (options.length <= 1) {
    return (
      <Badge badgeSize="sm">
        <Badge.Text>
          {accountUtils.shortenAddress({
            address: value,
          })}
        </Badge.Text>
      </Badge>
    );
  }
  return (
    <Select
      title="Choose an Address"
      placeholder="Choose an Address"
      renderTrigger={() => (
        <Badge badgeSize="sm" userSelect="none">
          <Badge.Text>
            {accountUtils.shortenAddress({
              address: value,
            })}
          </Badge.Text>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4" />
        </Badge>
      )}
      items={options.map((o) => ({ label: o, value: o }))}
      value={value}
      onChange={onChange}
      floatingPanelProps={{
        width: '$80',
      }}
    />
  );
};

type IAddressInteractionStatusProps = {
  status?: IAddressInteractionStatus;
};

const AddressInteractionStatus: FC<IAddressInteractionStatusProps> = ({
  status,
}) => {
  if (status === 'not-interacted') {
    return (
      <Badge badgeType="warning" badgeSize="sm">
        First Transfer
      </Badge>
    );
  }
  if (status === 'interacted') {
    return (
      <Badge badgeType="success" badgeSize="sm">
        Transferred
      </Badge>
    );
  }
  return null;
};

export type IAddressInputValue = {
  raw?: string;
  resolved?: string;
  pending?: boolean;
};

type IAddressInputProps = Omit<
  ComponentProps<typeof TextArea>,
  'value' | 'onChange'
> & {
  networkId: string;
  value?: IAddressInputValue;
  onChange?: (value: IAddressInputValue) => void;
  placeholder?: string;
  name?: string;
  autoError?: boolean;
  plugins?: IAddressPluginsOptions;
  enableNameResolve?: boolean; //
  enableAddressBook?: boolean;
  enableWalletName?: boolean;
  //
  accountId?: string;
  enableAddressInteractionStatus?: boolean;
};

export type IAddressQueryResult = {
  input?: string;
  isValid?: boolean;
  walletAccountName?: string;
  addressBookName?: string;
  resolveAddress?: string;
  resolveOptions?: string[];
  addressInteractionStatus?: IAddressInteractionStatus;
};

const defaultAddressInputPlugins: IAddressPluginsOptions = {
  clipboard: true,
  scan: true,
};

const allAddressInputPlugins: IAddressPluginsOptions = {
  clipboard: true,
  scan: true,
  contacts: true,
};

function AddressInput(props: IAddressInputProps) {
  const {
    name = '',
    value,
    onChange,
    networkId,
    placeholder,
    autoError = true,
    onBlur,
    plugins = defaultAddressInputPlugins,
    enableNameResolve = true,
    enableAddressBook,
    enableWalletName,
    accountId,
    enableAddressInteractionStatus,
    ...rest
  } = props;
  const intl = useIntl();
  const [inputText, setInputText] = useState<string>(value?.raw ?? '');
  const { setError, clearErrors, watch } = useFormContext();
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const rawAddress = watch([name, 'raw'].join('.'));
  const debounceText = useDebounce(inputText, 300, { trailing: true });

  const [queryResult, setQueryResult] = useState<IAddressQueryResult>({});

  const setResolveAddress = useCallback((text: string) => {
    setQueryResult((prev) => ({ ...prev, resolveAddress: text }));
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      textRef.current = text;
      setInputText(text);
      onChange?.({ raw: text, pending: true });
    },
    [onChange],
  );

  useEffect(() => {
    if (rawAddress && textRef.current !== rawAddress) {
      onChangeText(rawAddress);
    }
  }, [rawAddress, onChangeText]);

  useEffect(() => {
    async function main() {
      if (!debounceText) {
        setQueryResult({});
        return;
      }
      setLoading(true);
      try {
        const result =
          await backgroundApiProxy.serviceAccountProfile.queryAddress({
            networkId,
            accountId,
            address: debounceText,
            enableNameResolve,
            enableAddressBook,
            enableWalletName,
            enableAddressInteractionStatus,
          });
        if (result.input === textRef.current) {
          setQueryResult(result);
        }
      } finally {
        setLoading(false);
      }
    }
    void main();
  }, [
    debounceText,
    networkId,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableAddressInteractionStatus,
  ]);

  useEffect(() => {
    if (Object.keys(queryResult).length === 0) return;
    if (queryResult.isValid) {
      clearErrors(name);
      onChange?.({
        raw: queryResult.input,
        resolved: queryResult.resolveAddress ?? queryResult.input,
        pending: false,
      });
    } else {
      if (autoError) {
        setError(name, {
          message: intl.formatMessage({ id: 'form__address_invalid' }),
        });
      }
      onChange?.({ raw: queryResult.input, pending: false });
    }
  }, [queryResult, intl, clearErrors, setError, name, onChange, autoError]);

  const AddressInputExtension = useMemo(
    () => (
      <XStack
        justifyContent="space-between"
        flexWrap="wrap"
        alignItems="center"
      >
        <XStack space="$2">
          {loading ? (
            <Spinner />
          ) : (
            <XStack space="$2">
              {queryResult.walletAccountName ? (
                <Badge badgeType="success" badgeSize="sm">
                  {queryResult.walletAccountName}
                </Badge>
              ) : null}
              {queryResult.addressBookName ? (
                <Badge badgeType="success" badgeSize="sm">
                  {queryResult.addressBookName}
                </Badge>
              ) : null}
              {queryResult.resolveAddress ? (
                <ResolvedAddress
                  value={queryResult.resolveAddress}
                  options={queryResult.resolveOptions ?? []}
                  onChange={setResolveAddress}
                />
              ) : null}
              <AddressInteractionStatus
                status={queryResult.addressInteractionStatus}
              />
            </XStack>
          )}
        </XStack>
        <XStack space="$6">
          {plugins.clipboard ? (
            <ClipboardPlugin
              onChange={onChangeText}
              testID={`${rest.testID ?? ''}-clip`}
            />
          ) : null}
          {plugins.scan ? (
            <ScanPluginContainer
              onChange={onChangeText}
              testID={`${rest.testID ?? ''}-scan`}
            />
          ) : null}
          {plugins.contacts ? (
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.addressInput,
                sceneUrl: '',
              }}
              enabledNum={[0]}
              availableNetworksMap={{
                0: { networkIds: [networkId], defaultNetworkId: networkId },
              }}
            >
              <ContactsPlugin
                onChange={onChangeText}
                networkId={networkId}
                testID={`${rest.testID ?? ''}-contacts`}
              />
            </AccountSelectorProviderMirror>
          ) : null}
        </XStack>
      </XStack>
    ),
    [
      loading,
      onChangeText,
      plugins.clipboard,
      plugins.contacts,
      plugins.scan,
      queryResult.addressInteractionStatus,
      queryResult.resolveAddress,
      queryResult.resolveOptions,
      queryResult.walletAccountName,
      queryResult.addressBookName,
      setResolveAddress,
      networkId,
      rest.testID,
    ],
  );

  return (
    <BaseInput
      value={inputText}
      onChangeText={onChangeText}
      placeholder={
        placeholder ??
        // intl.formatMessage({ id: 'form__address_and_domain_placeholder' })
        'Enter address or domain name'
      }
      extension={AddressInputExtension}
      {...rest}
    />
  );
}

export { AddressInput, allAddressInputPlugins };
