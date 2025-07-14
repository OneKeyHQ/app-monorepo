import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Icon,
  IconButton,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { IE2EESocketUserInfo } from '@onekeyhq/e2ee-server/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EmailOTPDialog } from '@onekeyhq/kit/src/hooks/useLoginOneKeyId';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IPrimeTransferAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EPrimeTransferStatus,
  usePrimeTransferAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getAppDeviceIcon } from '@onekeyhq/shared/src/appDeviceInfo/utils/getAppDeviceIcon';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IDeviceItemProps {
  userInfo: IE2EESocketUserInfo | undefined;
}

function isRepeatedDigits(code: string): boolean {
  // Check for repeated digits (e.g., 666666, 111111)
  const firstDigit = code[0];
  return code.split('').every((digit) => digit === firstDigit);
}

function buildVerifyCode({
  userId,
  randomNumber,
}: {
  userId: string;
  randomNumber: string;
}) {
  const arr = userId?.split('--');
  const userPart = arr?.[arr.length - 1];
  if (!userPart) {
    throw new OneKeyLocalError('User part is required');
  }
  if (userPart.length !== 6) {
    throw new OneKeyLocalError('User part is incorrect');
  }
  if (!randomNumber) {
    throw new OneKeyLocalError('Random number is required');
  }
  if (randomNumber.length !== 6) {
    throw new OneKeyLocalError('Random number is incorrect');
  }
  // userPart:     338713
  // randomNumber: 576123
  // verifyCode:   804836
  const verifyCode = userPart
    .split('')
    .map((digit, index) => {
      const userDigit = parseInt(digit, 10);
      const randomDigit = parseInt(randomNumber[index] || '0', 10);
      return (userDigit + randomDigit) % 10;
    })
    .join('');

  // Check if verify code contains repeated digits
  if (isRepeatedDigits(verifyCode)) {
    throw new OneKeyLocalError(
      'Verification code contains repeated digits, retry required',
    );
  }

  return verifyCode;
}

function DeviceItem({ userInfo }: IDeviceItemProps) {
  const intl = useIntl();
  const [primeTransferAtom] = usePrimeTransferAtom();

  const isCurrentDevice = useMemo(() => {
    return userInfo?.id === primeTransferAtom.myUserId;
  }, [userInfo, primeTransferAtom.myUserId]);
  return (
    <XStack gap="$3" alignItems="center" justifyContent="space-between">
      <Stack bg="$bgStrong" p="$2" borderRadius="$3">
        {userInfo?.appPlatform ? (
          <Icon
            name={getAppDeviceIcon({
              instanceId: '',
              lastLoginTime: '',
              platform: userInfo.appPlatform,
              platformName: userInfo.appPlatformName,
              version: userInfo.appVersion,
              deviceName: platformEnv.appFullName,
            })}
            size="$6"
            color="$icon"
          />
        ) : null}
      </Stack>

      <Stack flex={1}>
        <SizableText color="$text" size="$bodyLgMedium">
          {userInfo?.appPlatformName}
        </SizableText>

        <SizableText color="$textSubdued" size="$bodyMd">
          {userInfo?.appDeviceName} {userInfo?.appVersion}{' '}
          {`(${userInfo?.id?.slice(0, 6) || ''})`}
        </SizableText>
      </Stack>

      {isCurrentDevice ? (
        <Badge badgeSize="lg">
          {intl.formatMessage({
            id: ETranslations.global_current,
          })}
        </Badge>
      ) : null}
    </XStack>
  );
}

export function WaitingTransferCompleteAlert() {
  return (
    <Alert
      title="Waiting for the transfer to complete..."
      type="info"
      icon="LoaderOutline"
    />
  );
}

export function PrimeTransferDirection({
  remotePairingCode,
}: {
  remotePairingCode: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [primeTransferAtom, setPrimeTransferAtom] = usePrimeTransferAtom();
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [waitingAlertVisible, setWaitingAlertVisible] = useState(false);

  const getRoomUsers = useCallback(async () => {
    let result: IE2EESocketUserInfo[] = [];
    if (
      primeTransferAtom.pairedRoomId &&
      primeTransferAtom.status !== EPrimeTransferStatus.init
    ) {
      result = await backgroundApiProxy.servicePrimeTransfer.getRoomUsers({
        roomId: primeTransferAtom.pairedRoomId,
      });
    }
    return result;
  }, [primeTransferAtom.pairedRoomId, primeTransferAtom.status]);

  const { result: roomUsers } = usePromiseResult<
    IE2EESocketUserInfo[]
  >(async () => {
    return getRoomUsers();
  }, [getRoomUsers]);

  const directionUserInfo = useMemo(() => {
    if (!roomUsers) {
      return undefined;
    }
    const user1 = roomUsers?.[0];
    const user2 = roomUsers?.[1];
    const transferDirection = primeTransferAtom.transferDirection;

    // Determine if user1 is sender or receiver
    let fromUser: IE2EESocketUserInfo | undefined =
      transferDirection?.fromUserId === user1?.id ? user1 : user2;
    let toUser: IE2EESocketUserInfo | undefined =
      transferDirection?.toUserId === user2?.id ? user2 : user1;

    if (fromUser?.id === toUser?.id) {
      fromUser = user1;
      toUser = user2;
    }
    return {
      fromUser,
      toUser,
    };
  }, [roomUsers, primeTransferAtom.transferDirection]);

  const changeDirection = useCallback(async () => {
    if (roomUsers?.length && roomUsers?.length >= 2) {
      await backgroundApiProxy.servicePrimeTransfer.changeTransferDirection({
        roomId: primeTransferAtom.pairedRoomId || '',
        fromUserId: directionUserInfo?.toUser.id || '',
        toUserId: directionUserInfo?.fromUser.id || '',
      });
    }
  }, [roomUsers, primeTransferAtom.pairedRoomId, directionUserInfo]);

  const handleStartTransfer = useCallback(async () => {
    if (!directionUserInfo?.fromUser || !directionUserInfo?.toUser) {
      Toast.error({
        title: 'Please select a device to transfer',
      });
      return;
    }

    // Use the new ServicePrimeTransfer
    const result = await backgroundApiProxy.servicePrimeTransfer.startTransfer({
      roomId: primeTransferAtom.pairedRoomId || '',
      fromUserId: directionUserInfo?.fromUser.id || '',
      toUserId: directionUserInfo?.toUser.id || '',
    });
  }, [
    directionUserInfo?.fromUser,
    directionUserInfo?.toUser,
    primeTransferAtom.pairedRoomId,
  ]);

  const dialogRef = useRef<IDialogInstance | null>(null);

  useEffect(() => {
    const fn = (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      data: IAppEventBusPayload[EAppEventBusNames.PrimeTransferCancel],
    ) => {
      void dialogRef.current?.close();
      setPrimeTransferAtom(
        (v): IPrimeTransferAtomData => ({
          ...v,
          status: EPrimeTransferStatus.paired,
        }),
      );
    };
    appEventBus.on(EAppEventBusNames.PrimeTransferCancel, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferCancel, fn);
    };
  }, [setPrimeTransferAtom]);

  const isClosedBySendData = useRef(false);

  const dialogOnClose = useCallback(async () => {
    if (isClosedBySendData.current) {
      return;
    }
    await backgroundApiProxy.servicePrimeTransfer.cancelTransfer();
  }, []);

  const verifyCodeAndSendData = useCallback(
    async ({
      inputCode,
      verifyCode,
    }: {
      inputCode: string;
      verifyCode: string;
    }) => {
      if (!verifyCode) {
        throw new OneKeyLocalError('Verification code does not exist');
      }
      if (inputCode !== verifyCode) {
        throw new OneKeyLocalError('Verification code is incorrect');
      }

      await timerUtils.wait(120);
      // await onConfirm({ code, uuid });
      void dialogRef.current?.close();
      const transferData =
        await backgroundApiProxy.servicePrimeTransfer.getDataForTransfer();
      if (transferData?.isEmptyData) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.transfer_no_data,
          }),
        });
        return;
      }

      await backgroundApiProxy.servicePrimeTransfer.sendTransferData({
        transferData,
      });
      setWaitingAlertVisible(true);
      isClosedBySendData.current = true;
      // resolve();

      navigation.popStack();
      Dialog.show({
        title: intl.formatMessage(
          {
            id: ETranslations.transfer_data_sent_to_target,
          },
          {
            'deviceType': directionUserInfo?.toUser?.appDeviceName,
          },
        ),
        description: intl.formatMessage({
          id: ETranslations.transfer_transfer_loading,
        }),
        showCancelButton: false,
        showConfirmButton: false,
        disableDrag: true,
        dismissOnOverlayPress: false,
      });
    },
    [intl, navigation, directionUserInfo?.toUser?.appDeviceName],
  );

  useEffect(() => {
    if (primeTransferAtom.status === EPrimeTransferStatus.transferring) {
      const isTransferFromMe =
        primeTransferAtom?.myUserId === directionUserInfo?.fromUser?.id;
      if (isTransferFromMe) {
        const verifyCode = buildVerifyCode({
          userId: directionUserInfo?.toUser?.id || '',
          randomNumber: primeTransferAtom.transferDirection?.randomNumber || '',
        });
        if (!verifyCode) {
          throw new OneKeyLocalError('Verification code does not exist');
        }
        isClosedBySendData.current = false;
        void dialogRef.current?.close();
        dialogRef.current = Dialog.show({
          disableDrag: true,
          dismissOnOverlayPress: false,
          onClose: dialogOnClose,
          renderContent: (
            <EmailOTPDialog
              title={intl.formatMessage({
                id: ETranslations.prime_enter_verification_code,
              })}
              description="Please enter the verification code from the other device"
              hideResendButton
              onConfirm={async (code: string) => {
                await verifyCodeAndSendData({
                  inputCode: code,
                  verifyCode,
                });
              }}
              sendCode={async () => {
                // const result =
                //   await backgroundApiProxy.servicePrime.sendEmailOTP(scene);
                // uuid = result.uuid;
                // return result;
              }}
            />
          ),
        });
      } else {
        const verifyCode = buildVerifyCode({
          userId: primeTransferAtom?.myUserId || '',
          randomNumber: primeTransferAtom.transferDirection?.randomNumber || '',
        });
        isClosedBySendData.current = false;
        void dialogRef.current?.close();
        dialogRef.current = Dialog.show({
          showCancelButton: false,
          showConfirmButton: false,
          // title: intl.formatMessage({
          //   id: ETranslations.prime_enter_verification_code,
          // }),
          title: 'Verification code',
          description:
            'Please enter the verification code on the other device to continue',
          renderContent: (
            <SizableText size="$heading4xl">{verifyCode}</SizableText>
          ),
          disableDrag: true,
          dismissOnOverlayPress: false,
          onClose: dialogOnClose,
        });
      }
    }
  }, [
    remotePairingCode,
    directionUserInfo?.fromUser?.id,
    directionUserInfo?.toUser?.id,
    intl,
    primeTransferAtom?.myUserId,
    primeTransferAtom.status,
    dialogOnClose,
    verifyCodeAndSendData,
    primeTransferAtom.transferDirection?.randomNumber,
  ]);

  useEffect(() => {
    const fn = (
      data: IAppEventBusPayload[EAppEventBusNames.PrimeTransferDataReceived],
    ) => {
      isClosedBySendData.current = true;
      void dialogRef.current?.close();
      const param: IPrimeParamList[EPrimePages.PrimeTransferPreview] = {
        directionUserInfo,
        transferData: data.data,
      };
      navigation.navigate(EPrimePages.PrimeTransferPreview, param);
    };
    appEventBus.on(EAppEventBusNames.PrimeTransferDataReceived, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferDataReceived, fn);
    };
  }, [directionUserInfo, navigation]);

  const debugButtons = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <>
          <Button
            onPress={async () => {
              const result = await getRoomUsers();
              Dialog.debugMessage({
                debugMessage: result,
              });
            }}
          >
            Print Room Users
          </Button>
          <Button
            onPress={async () => {
              await backgroundApiProxy.servicePrimeTransfer.verifyPairingCodeDevTest();
            }}
          >
            Verify Pairing Code
          </Button>
        </>
      );
    }
    return <></>;
  }, [getRoomUsers]);

  return (
    <>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.transfer_transfer_data,
        })}
      />

      <Stack p="$5" gap="$3.5">
        <Stack gap="$1">
          <SizableText color="$textSubdued" size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.global_from,
            })}
          </SizableText>

          <DeviceItem userInfo={directionUserInfo?.fromUser} />
        </Stack>

        {/* <Icon
        name="SwitchVerOutline"
        size="$5"
        px="$5"
        color="$iconSubdued"
        onPress={changeDirection}
      /> */}
        <XStack>
          <IconButton
            icon="SwitchVerOutline"
            size="large"
            px="$5"
            color="$iconSubdued"
            variant="tertiary"
            onPress={changeDirection}
          />
        </XStack>

        <Stack gap="$1">
          <SizableText color="$textSubdued" size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.global_to,
            })}
          </SizableText>

          <DeviceItem userInfo={directionUserInfo?.toUser} />
        </Stack>

        {waitingAlertVisible ? <WaitingTransferCompleteAlert /> : null}

        {debugButtons}
      </Stack>
      <Page.Footer
        confirmButtonProps={{
          disabled: primeTransferAtom.status !== EPrimeTransferStatus.paired,
          loading:
            primeTransferAtom.status === EPrimeTransferStatus.transferring,
        }}
        onConfirm={() => {
          void handleStartTransfer();
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_transfer,
        })}
      />
    </>
  );
}
