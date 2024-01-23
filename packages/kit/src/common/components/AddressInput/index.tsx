import {
  type ComponentProps,
  type FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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
  useClipboard,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useDebounce } from '../../../hooks/useDebounce';

type IAddressPluginsOptions = {
  clipboard?: boolean;
  scan?: boolean;
  contacts?: boolean;
};

type IAddressPluginProps = {
  onChange?: (text: string) => void;
};

const ClipboardPlugin: FC<IAddressPluginProps> = ({ onChange }) => {
  const { getClipboard } = useClipboard();
  const onPress = useCallback(async () => {
    const text = await getClipboard();
    onChange?.(text);
  }, [onChange, getClipboard]);
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
    // TODO: after QrCode final release, update callback result
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
  plugins?: IAddressPluginsOptions;
  enableNameResolve?: boolean; //
  enableAddressBook?: boolean;
  enableFirstTransferCheck?: boolean;
};

export type IAddressQueryResult = {
  input?: string;
  isValid?: boolean;
  walletAccountName?: string;
  resolveAddress?: string;
  resolveOptions?: string[];
  isFirstTransfer?: boolean;
};

const defaultAddressInputPlugins: IAddressPluginsOptions = {
  clipboard: true,
  scan: true,
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
    plugins = defaultAddressInputPlugins,
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
        const result = await backgroundApiProxy.serviceAddress.queryAddress({
          networkId,
          address: debounceText,
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
                {queryResult.walletAccountName ? (
                  <Badge badgeType="success" badgeSize="sm">
                    {queryResult.walletAccountName}
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
            {plugins.clipboard ? (
              <ClipboardPlugin onChange={onChangeText} />
            ) : null}
            {plugins.scan ? <ScanPlugin onChange={onChangeText} /> : null}
            {plugins.contacts ? <ContactsPlugin /> : null}
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export { AddressInput };
