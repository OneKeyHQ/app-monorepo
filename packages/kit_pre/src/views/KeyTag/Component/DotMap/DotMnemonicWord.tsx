import type { FC } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Icon, Typography } from '@onekeyhq/components';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';

import { KeyTagMnemonicStatus } from '../../types';

import DotSpace from './DotSpace';

import type { KeyTagMnemonic } from '../../types';

type DotMnemonicWordProps = {
  size?: number;
  space?: number;
  groupDotCount?: number;
  groupCount?: number;
  mnemonicWordData?: KeyTagMnemonic;
  showWordStatus?: boolean;
  showDigitCode?: boolean;
  showResult?: boolean;
  showIcon?: boolean;
  disabled?: boolean;
  onChange?: (index: number, value: boolean) => void;
};

type DotGroupProps = {
  lightsData?: boolean[];
  groupIndex?: number;
  groupDotCount?: number;
  showDigitCode?: boolean;
  digitCodeLimit?: number;
  size?: number;
  disabled?: boolean;
  onChange?: (index: number, value: boolean) => void;
  defaultBgColor?: string;
};

export const DotGroup: FC<DotGroupProps> = ({
  showDigitCode,
  size = 5,
  groupIndex = 0,
  groupDotCount = 4,
  lightsData = [],
  digitCodeLimit = 11,
  disabled = false,
  defaultBgColor,
  onChange,
}) => (
  <>
    {lightsData.map((data, index) => {
      const indexNumber = index + groupIndex * groupDotCount;
      return (
        <Box flexDirection="column">
          {showDigitCode ? (
            <Box
              style={{ width: size * 4, height: 40 }}
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              mb={3}
            >
              <Box
                flexDirection="row"
                justifyContent="flex-start"
                alignItems="center"
                style={{
                  width: 40,
                  height: size * 4,
                  transform: [{ rotate: '-90deg' }],
                }}
              >
                <Typography.Body2Mono
                  lineHeight="18px"
                  textAlign="center"
                  color="text-subdued"
                >
                  {2 ** (digitCodeLimit - indexNumber)}
                </Typography.Body2Mono>
              </Box>
            </Box>
          ) : null}
          <DotSpace
            defaultBgColor={defaultBgColor}
            disabled={disabled}
            size={size}
            defaultLight={data}
            onClickSpace={(open) => {
              if (onChange) {
                onChange(indexNumber, open);
              }
            }}
          />
        </Box>
      );
    })}
  </>
);

type MnemonicStatusProps = {
  status?: KeyTagMnemonicStatus;
  word?: string;
  showResult?: boolean;
};

export const MnemonicStatus: FC<MnemonicStatusProps> = ({
  showResult,
  status,
  word,
}) => {
  const intl = useIntl();
  const { statusTitle, titleColor } = useMemo(() => {
    const res: { statusTitle?: string; titleColor: ThemeToken } = {
      titleColor: 'text-default',
    };
    switch (status) {
      case KeyTagMnemonicStatus.VERIF:
        res.statusTitle = showResult ? word?.toUpperCase() : '';
        break;
      case KeyTagMnemonicStatus.INCORRECT:
        res.statusTitle = intl
          .formatMessage({ id: 'form__incorrect_dotmap' })
          .toUpperCase();
        res.titleColor = 'text-critical';
        break;
      case KeyTagMnemonicStatus.EMPTY:
        res.statusTitle = intl
          .formatMessage({ id: 'form__empty' })
          .toUpperCase();
        res.titleColor = 'text-warning';
        break;
      case KeyTagMnemonicStatus.UNVERIF:
        res.statusTitle = showResult ? '-' : '';
        break;
      default:
        break;
    }
    return res;
  }, [intl, showResult, status, word]);
  return (
    <Box flexDirection="row">
      {status === KeyTagMnemonicStatus.INCORRECT ? (
        <Icon color={titleColor} name="ExclamationCircleSolid" />
      ) : null}
      <Typography.Body1Mono color={titleColor}>
        {statusTitle}
      </Typography.Body1Mono>
    </Box>
  );
};

const DotMnemonicWord: FC<DotMnemonicWordProps> = ({
  space = 2,
  size = 5,
  groupDotCount = 4,
  groupCount = 3,
  mnemonicWordData,
  showWordStatus = false,
  showDigitCode = false,
  showIcon = false,
  disabled = false,
  showResult = true,
  onChange,
}) => {
  const groupArr = useMemo(() => {
    const groupRes = [];
    let i = 0;
    while (i < groupCount) {
      groupRes.push(
        mnemonicWordData?.dotMapData?.slice(
          i * groupDotCount,
          groupDotCount * (i + 1),
        ),
      );
      i += 1;
    }
    return groupRes;
  }, [groupCount, groupDotCount, mnemonicWordData]);
  return (
    <Box flexDirection="column">
      {showWordStatus ? (
        <Box flexDirection="row" justifyContent="space-between" my={1}>
          <Typography.Body1Mono color="text-subdued">
            {mnemonicWordData?.index}
          </Typography.Body1Mono>
          <MnemonicStatus
            showResult={showResult}
            status={mnemonicWordData?.status}
            word={mnemonicWordData?.mnemonicWord}
          />
        </Box>
      ) : null}
      <Box flexDirection="row">
        {!showWordStatus ? (
          <Box flexDirection="column" justifyContent="flex-end">
            {showIcon ? (
              <Box mb={3}>
                <Icon
                  size={32}
                  name="LogoCircularIllus"
                  color="icon-disabled"
                />
              </Box>
            ) : null}
            <Box
              w="32px"
              h={size}
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="flex-start"
            >
              <Typography.Body1Mono
                lineHeight="18px"
                color="text-subdued"
                marginRight="8px"
              >
                {mnemonicWordData?.index}
              </Typography.Body1Mono>
            </Box>
          </Box>
        ) : null}
        <HStack space={space}>
          {groupArr.map((group, index) => (
            <DotGroup
              defaultBgColor={
                mnemonicWordData?.status === KeyTagMnemonicStatus.FILL
                  ? 'background-hovered'
                  : 'background-default'
              }
              disabled={disabled}
              size={size}
              groupIndex={index}
              groupDotCount={groupDotCount}
              showDigitCode={showDigitCode}
              lightsData={group}
              onChange={onChange}
            />
          ))}
        </HStack>
      </Box>
    </Box>
  );
};

export default memo(DotMnemonicWord);
