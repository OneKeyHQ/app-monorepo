import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Badge,
  BottomSheetModal,
  Box,
  HStack,
  Icon,
  Spinner,
  Text,
  Token,
  VStack,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import { formatMessage } from '@onekeyhq/components/src/Provider';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../../hooks';
import { showOverlay } from '../../../../utils/overlayUtils';
import { useDerivationPath } from '../../hooks/useDerivationPath';

import type { IDerivationOption } from '../../hooks/useDerivationPath';

type IDerivationPathBottomSheetModalProps = {
  type: 'create' | 'search';
  walletId: string;
  networkId: string | undefined;
  onSelect: (option: IDerivationOption) => void;
};

type IVerifiedOption = IDerivationOption & {
  canCreateNextAccount: boolean;
};

const DerivationPathHeader: FC<{ networkId: string | undefined }> = ({
  networkId,
}) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

const DerivationOption: FC<{
  option: IDerivationOption;
  selectedOption: string;
  onPress: (option: IDerivationOption) => void;
  showSubDesc: boolean;
  showTemplate: boolean;
  disabled: boolean;
}> = ({
  option,
  selectedOption,
  onPress,
  showSubDesc,
  showTemplate,
  disabled,
}) => {
  const intl = useIntl();
  const textColor = disabled ? 'text-disabled' : 'text-subdued';
  return (
    <Pressable
      mr="7px"
      my={2}
      onPress={() => onPress(option)}
      isDisabled={disabled}
    >
      <HStack alignItems="center" justifyContent="space-between">
        <VStack flex={1}>
          <HStack mb={1}>
            {option.label && (
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body1Strong' }}
                color={disabled ? 'text-subdued' : 'text-default'}
              >
                {typeof option.label === 'string'
                  ? option.label
                  : intl.formatMessage({ id: option.label?.id })}
              </Text>
            )}
            {option.recommended && (
              <Badge
                ml={2}
                size="sm"
                title={intl.formatMessage({ id: 'form__recommended' })}
              />
            )}
            {option.notRecommended && (
              <Badge
                ml={2}
                size="sm"
                title={intl.formatMessage({ id: 'form__not_recommended' })}
              />
            )}
          </HStack>
          {option.desc && (
            <Text
              typography={{ sm: 'Body2Mono', md: 'Body2Mono' }}
              color={textColor}
            >
              {typeof option.desc === 'string'
                ? option.desc
                : intl.formatMessage(
                    { id: option.desc?.id },
                    option.desc?.placeholder,
                  )}
            </Text>
          )}
          <Text
            typography={{ sm: 'Body2Mono', md: 'Body2Mono' }}
            color={textColor}
          >
            {showTemplate && option.template.replace('x', '*')}
            {showSubDesc && option.subDesc}
          </Text>
        </VStack>
        {selectedOption === option.key && (
          <Icon size={14} name="CheckMini" color="icon-success" />
        )}
      </HStack>
    </Pressable>
  );
};

const DerivationPathContent: FC<IDerivationPathBottomSheetModalProps> = ({
  type,
  walletId,
  networkId,
  onSelect,
}) => {
  const intl = useIntl();
  const { derivationOptions, isUTXOModel } = useDerivationPath(
    walletId,
    networkId,
  );
  const [selectedOption, setSelectedOption] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [verifiedOptions, setVerifiedOptions] = useState<IVerifiedOption[]>([]);

  useEffect(() => {
    const promises = derivationOptions.map(async (option) => {
      let canCreateNextAccount = false;
      try {
        await backgroundApiProxy.validator.validateCanCreateNextAccount(
          walletId,
          networkId ?? '',
          option.template,
        );
        canCreateNextAccount = true;
      } catch (e) {
        canCreateNextAccount = false;
      }

      return { ...option, canCreateNextAccount };
    });

    setIsLoading(true);
    Promise.all(promises)
      .then((result) => {
        setVerifiedOptions(result);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [derivationOptions, walletId, networkId]);

  const validOptions = useMemo(
    () => verifiedOptions.filter((o) => o.canCreateNextAccount),
    [verifiedOptions],
  );
  const showValidOptions = useMemo(
    () => validOptions.length > 0,
    [validOptions],
  );
  const invalidOptions = useMemo(
    () => verifiedOptions.filter((o) => !o.canCreateNextAccount),
    [verifiedOptions],
  );
  const showInvalidOptions = useMemo(
    () => invalidOptions.length > 0,
    [invalidOptions],
  );

  const handleSelect = useCallback(
    (option: IDerivationOption) => {
      setSelectedOption(option.key);
      onSelect?.(option);
    },
    [onSelect],
  );

  const isSearchAccount = type === 'search';
  return (
    <Box>
      {isSearchAccount && (
        <Text typography={{ sm: 'Body2', md: 'Body2' }} mr="7px">
          {intl.formatMessage({
            id: 'content__if_you_dont_see_the_account_you_expect_try_switching_the_deriation_path',
          })}
        </Text>
      )}
      {showValidOptions && (
        <Box mt={isSearchAccount ? 4 : 0}>
          {validOptions.map((option) => (
            <DerivationOption
              key={option.key}
              option={option}
              onPress={handleSelect}
              selectedOption={selectedOption}
              showSubDesc={!!isUTXOModel}
              showTemplate={!isUTXOModel}
              disabled={isLoading}
            />
          ))}
        </Box>
      )}
      {showInvalidOptions && (
        <Box>
          <Box mb={2} mt={6}>
            <Alert
              title={intl.formatMessage({
                id: 'content__last_account_of_these_types_are_not_used',
              })}
              description={intl.formatMessage({
                id: 'content__you_cannot_create_a_new_account_when_the_last_account_of_that_type_created',
              })}
              dismiss={false}
              alertType="info"
            />
          </Box>
          {invalidOptions.map((option) => (
            <DerivationOption
              key={option.key}
              option={option}
              onPress={handleSelect}
              selectedOption={selectedOption}
              showSubDesc={!!isUTXOModel}
              showTemplate={!isUTXOModel}
              disabled
            />
          ))}
        </Box>
      )}
      {isLoading && <Spinner my={2} size="sm" />}
    </Box>
  );
};

const showDerivationPathBottomSheetModal = ({
  type,
  walletId,
  networkId,
  onSelect,
}: IDerivationPathBottomSheetModalProps) => {
  showOverlay((close) => (
    <BottomSheetModal
      title={formatMessage({
        id:
          type === 'create' ? 'action__add_account' : 'title__derivation_path',
      })}
      headerDescription={<DerivationPathHeader networkId={networkId} />}
      closeOverlay={close}
    >
      <DerivationPathContent
        type={type}
        walletId={walletId}
        networkId={networkId}
        onSelect={(option) => {
          close?.();
          setTimeout(() => onSelect?.(option));
        }}
      />
    </BottomSheetModal>
  ));
};

export default showDerivationPathBottomSheetModal;
