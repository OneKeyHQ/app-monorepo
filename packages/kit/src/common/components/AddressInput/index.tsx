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
  Badge,
  Icon,
  IconButton,
  Select,
  Spinner,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressItem } from '@onekeyhq/kit/src/common/components/AddressBook/type';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useDebounce } from '../../../hooks/useDebounce';
import { useAddressBookPick } from '../AddressBook/hooks/useAddressBook';
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

const ContactsPlugin: FC<IContactsPluginProps> = ({
  onChange,
  networkId,
  testID,
}) => {
  const pick = useAddressBookPick();
  const onPress = useCallback(() => {
    void pick({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
      },
    });
  }, [onChange, pick, networkId]);
  return (
    <IconButton
      title="Contacts"
      onPress={onPress}
      variant="tertiary"
      icon="BookOpenOutline"
      testID={testID}
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
  enableFirstTransferCheck?: boolean;
};

export type IAddressQueryResult = {
  input?: string;
  isValid?: boolean;
  walletAccountName?: string;
  addressBookName?: string;
  resolveAddress?: string;
  resolveOptions?: string[];
  isFirstTransfer?: boolean;
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
    ...rest
  } = props;
  const intl = useIntl();
  const [inputText, setInputText] = useState<string>(value?.raw ?? '');
  const { setError, clearErrors } = useFormContext();
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const isDirty = useRef(false);
  const debounceText = useDebounce(inputText, 300, { trailing: true });

  const [queryResult, setQueryResult] = useState<IAddressQueryResult>({});

  const setResolveAddress = useCallback((text: string) => {
    setQueryResult((prev) => ({ ...prev, resolveAddress: text }));
  }, []);

  const onChangeText = useCallback((text: string) => {
    isDirty.current = true;
    setInputText(text);
  }, []);

  useEffect(() => {
    textRef.current = inputText;
    if (isDirty.current) {
      onChange?.({ raw: inputText, pending: true });
    }
  }, [inputText, onChange]);

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
            address: debounceText,
            enableNameResolve,
            enableAddressBook,
          });
        if (result.input === textRef.current) {
          setQueryResult(result);
        }
      } finally {
        setLoading(false);
      }
    }
    void main();
  }, [debounceText, networkId, enableNameResolve, enableAddressBook]);

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
            <>
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
              {queryResult.isFirstTransfer ? (
                <Badge badgeType="warning" badgeSize="sm">
                  First Transfer
                </Badge>
              ) : null}
            </>
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
            <ContactsPlugin
              onChange={onChangeText}
              networkId={networkId}
              testID={`${rest.testID ?? ''}-contacts`}
            />
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
      queryResult.isFirstTransfer,
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
