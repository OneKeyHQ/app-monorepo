import {
  type ComponentProps,
  type FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import * as Clipboard from 'expo-clipboard';
import { useFormContext } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  IconButton,
  Select,
  Spinner,
  TextArea,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useDebounce } from '../../../hooks/useDebounce';

type IAddressPluginsOptions = 'clipboard' | 'scan' | 'contacts';

type IAddressPluginProps = {
  onChange?: (text: string) => void;
};

const ClipboardPlugin: FC<IAddressPluginProps> = ({ onChange }) => {
  const onPress = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    onChange?.(text);
  }, [onChange]);
  return (
    <IconButton
      variant="tertiary"
      size="small"
      icon="Copy1Outline"
      onPress={onPress}
    />
  );
};

const ScanPlugin: FC<IAddressPluginProps> = ({ onChange }) => {
  const { start } = useScanQrCode();
  const onPress = useCallback(async () => {
    const address = await start();
    onChange?.(address);
  }, [onChange, start]);
  return (
    <IconButton
      variant="tertiary"
      size="small"
      icon="ScanSolid"
      onPress={onPress}
    />
  );
};

const ContactsPlugin: FC<IAddressPluginProps> = ({ onChange }) => {
  const onPress = useCallback(() => {
    // TODO: navigation to address book
    onChange?.('');
  }, [onChange]);
  return (
    <IconButton
      onPress={onPress}
      variant="tertiary"
      size="small"
      icon="BookOpenOutline"
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
      <Badge badgeType="info" badgeSize="sm">
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
        <Badge badgeType="info" badgeSize="sm">
          <Badge.Text>
            {accountUtils.shortenAddress({
              address: value,
            })}
          </Badge.Text>
          <Icon name="DotVerSolid" size="$3" />
        </Badge>
      )}
      items={options.map((o) => ({ label: o, value: o }))}
      value={value}
      onChange={onChange}
    />
  );
};

async function validateAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  try {
    await backgroundApiProxy.serviceAddress.fetchAddressDetails({
      networkId,
      accountAddress: address,
      withValidate: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function getContactName(params: {
  networkId: string;
  address: string;
}): Promise<string | undefined> {
  console.log('params', params);
  // TODO: address book
  return undefined;
}

async function isFirstTransfer(params: {
  networkId: string;
  accountId: string;
  to: string;
}): Promise<boolean> {
  console.log('params', params);
  // TODO: API
  return Promise.resolve(false);
}

export type IAddressInputValue = {
  raw?: string;
  resolved?: string;
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
  plugins?: IAddressPluginsOptions[];
  enableNameResolve?: boolean; //
  enableAddressBook?: boolean;
  enableFirstTransferCheck?: boolean;
};

type IAddressQueryResult = {
  input?: string;
  isValid?: boolean;
  walletName?: string;
  resolveAddress?: string;
  resolveOptions?: string[];
  isFirstTransfer?: boolean;
};

type IAddressQueryOptions = {
  networkId: string;
  enableNameResolve?: boolean;
  enableWalletName?: boolean;
  enableFirstTransferCheck?: boolean;
};

const queryAddress = async (
  input: string,
  { networkId, enableNameResolve }: IAddressQueryOptions,
) => {
  const result: IAddressQueryResult = { input };
  if (networkId) {
    result.isValid = await validateAddress({ networkId, address: input });
    await backgroundApiProxy.serviceValidator.validateAddress({
      networkId,
      address: input,
    });
    const includeDot = input.split('.').length > 1;
    if (includeDot && enableNameResolve) {
      const resolveNames =
        await backgroundApiProxy.serviceNameResolver.resolveName({
          name: input,
          networkId,
        });
      if (resolveNames) {
        result.resolveAddress = resolveNames.names?.[0].value;
        result.resolveOptions = resolveNames.names.map((o) => o.value);

        if (!result.isValid) {
          const resolveValidateResult =
            await backgroundApiProxy.serviceValidator.validateAddress({
              networkId,
              address: result.resolveAddress,
            });
          result.isValid = resolveValidateResult.isValid;
        }
      }
    }
  }
  return result;
};

function AddressInput(props: IAddressInputProps) {
  const {
    name = '',
    value,
    onChange,
    networkId,
    placeholder,
    disabled,
    error,
    editable,
    size,
    onBlur,
    plugins = ['clipboard', 'scan'],
    enableNameResolve = true,
    enableAddressBook,
    ...rest
  } = props;
  const intl = useIntl();
  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });
  const [inputText, setInputText] = useState<string>(value?.raw ?? '');
  const { setError, clearErrors } = useFormContext();
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const isDirty = useRef(false);
  const debounceText = useDebounce(inputText, 300, { trailing: true });

  const [isFocus, setFocus] = useState<boolean>(false);
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
      onChange?.({ raw: inputText });
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
        const result = await queryAddress(debounceText, {
          networkId,
          enableNameResolve,
        });
        if (result.input === textRef.current) {
          setQueryResult(result);
        }
      } finally {
        setLoading(false);
      }
    }
    void main();
  }, [debounceText, networkId, enableNameResolve]);

  useEffect(() => {
    if (Object.keys(queryResult).length === 0) return;
    if (queryResult.isValid) {
      clearErrors(name);
      onChange?.({
        raw: queryResult.input,
        resolved: queryResult.resolveAddress ?? queryResult.input,
      });
    } else {
      setError(name, {
        message: intl.formatMessage({ id: 'form__address_invalid' }),
      });
    }
  }, [queryResult, intl, clearErrors, setError, name, onChange]);

  return (
    <YStack space="$2">
      <YStack
        space="$2"
        borderWidth={sharedStyles.borderWidth}
        borderColor={sharedStyles.borderColor}
        borderRadius={sharedStyles.borderRadius}
        outlineColor={
          isFocus ? sharedStyles.focusStyle.outlineColor : undefined
        }
        outlineStyle={
          isFocus ? sharedStyles.focusStyle.outlineStyle : undefined
        }
        outlineWidth={
          isFocus ? sharedStyles.focusStyle.outlineWidth : undefined
        }
      >
        <TextArea
          w="full"
          value={inputText}
          onChangeText={onChangeText}
          placeholder={
            placeholder ??
            intl.formatMessage({
              id: 'form__address_and_domain_placeholder',
            })
          }
          onFocus={() => setFocus(true)}
          onBlur={(e) => {
            setFocus(false);
            onBlur?.(e);
          }}
          borderColor="$transparent"
          hoverStyle={{ borderColor: '$transparent' }}
          focusStyle={{ borderColor: '$transparent' }}
          {...rest}
        />
        <XStack
          justifyContent="space-between"
          px={sharedStyles.px}
          pb={sharedStyles.py}
        >
          <XStack space="$1">
            {loading ? (
              <XStack justifyContent="center" alignItems="center">
                <Spinner />
              </XStack>
            ) : (
              <XStack>
                {queryResult.walletName ? (
                  <Badge badgeType="success" badgeSize="sm">
                    {queryResult.walletName}
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
              </XStack>
            )}
          </XStack>
          <XStack space="$2">
            {plugins.includes('clipboard') ? (
              <ClipboardPlugin onChange={onChangeText} />
            ) : null}
            {plugins.includes('scan') ? (
              <ScanPlugin onChange={onChangeText} />
            ) : null}
            {plugins.includes('contacts') ? <ContactsPlugin /> : null}
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export { AddressInput };
