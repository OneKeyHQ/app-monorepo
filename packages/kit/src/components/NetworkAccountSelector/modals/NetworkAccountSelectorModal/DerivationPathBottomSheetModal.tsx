import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  Badge,
  BottomSheetModal,
  Box,
  Divider,
  HStack,
  Icon,
  Spinner,
  Text,
  Token,
  VStack,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../../hooks';
import { showOverlay } from '../../../../utils/overlayUtils';
import { useDerivationPath } from '../../hooks/useDerivationPath';

import type { IDerivationOption } from '../../hooks/useDerivationPath';

type IDerivationPathBottomSheetModalProps = {
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
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body1Strong' }}
              color={disabled ? 'text-subdued' : 'text-default'}
            >
              {option.label}
            </Text>
            {option.recommended && (
              <Badge ml={2} size="sm" title="Recommanded" />
            )}
            {option.notRecommended && (
              <Badge ml={2} size="sm" title="Not Recommended" />
            )}
          </HStack>
          <Text
            typography={{ sm: 'Body2Mono', md: 'Body2Mono' }}
            fontFamily="mono"
            color={textColor}
          >
            {option.desc}
          </Text>
          <Text
            typography={{ sm: 'Body2Mono', md: 'Body2Mono' }}
            fontFamily="mono"
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
  walletId,
  networkId,
  onSelect,
}) => {
  const intl = useIntl();
  const { derivationOptions, isBTCLikeCoin } = useDerivationPath(networkId);
  const [selectedOption, setSelectedOption] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [verifiedOptions, setVerifiedOptions] = useState<IVerifiedOption[]>([]);

  useEffect(() => {
    const promises = derivationOptions.map(async (option) => {
      let canCreateNextAccount = false;
      try {
        const usedPurpose = parseInt(option.category.split("'/")[0]);
        await backgroundApiProxy.validator.validateCanCreateNextAccount(
          walletId,
          networkId ?? '',
          usedPurpose,
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

  return (
    <Box>
      <Text typography={{ sm: 'Body2', md: 'Body2' }} mr="7px">
        {`If you don't see the accounts you expect, try switching the HD Path.`}
      </Text>
      {showValidOptions && (
        <Box mt={4}>
          {validOptions.map((option) => (
            <DerivationOption
              key={option.key}
              option={option}
              onPress={handleSelect}
              selectedOption={selectedOption}
              showSubDesc={isBTCLikeCoin}
              showTemplate={!isBTCLikeCoin}
              disabled={isLoading}
            />
          ))}
        </Box>
      )}
      {showInvalidOptions && (
        <Box>
          {showValidOptions && <Divider h={StyleSheet.hairlineWidth} my={8} />}
          <Box mb={2} mt={showValidOptions ? 0 : 8}>
            <Alert
              title="Last accounts of these types are not used"
              description="You cannot create a new account when the last account of that type created has not yet received a transaction."
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
              showSubDesc={isBTCLikeCoin}
              showTemplate={!isBTCLikeCoin}
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
  walletId,
  networkId,
  onSelect,
}: IDerivationPathBottomSheetModalProps) => {
  showOverlay((close) => (
    <BottomSheetModal
      title="Derivation Path"
      headerDescription={<DerivationPathHeader networkId={networkId} />}
      closeOverlay={close}
    >
      <DerivationPathContent
        walletId={walletId}
        networkId={networkId}
        onSelect={(option) => {
          onSelect?.(option);
          close?.();
        }}
      />
    </BottomSheetModal>
  ));
};

export default showDerivationPathBottomSheetModal;
