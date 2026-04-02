/* eslint-disable  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { useCallback, useRef, useState } from 'react';

import {
  Button,
  LottieView,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

const LottieDemo = () => {
  const ref = useRef<any>(null);
  const [show, setShow] = useState(true);
  const [loop, setLoop] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  const createNewLottieView = () => {
    setShow(false);
    setTimeout(() => {
      setShow(true);
    }, 100);
  };
  return (
    <YStack gap="$5">
      <XStack h={100}>
        {show ? (
          <LottieView
            ref={ref}
            width="100%"
            height="$24"
            autoPlay={autoPlay}
            loop={loop}
            source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
          />
        ) : null}
      </XStack>
      <XStack gap="$5" alignItems="center">
        <SizableText>loop: </SizableText>
        <Switch
          value={loop}
          onChange={(value) => {
            setLoop(value);

            createNewLottieView();
          }}
        />
      </XStack>
      <XStack gap="$5" alignItems="center">
        <SizableText>autoPlay: </SizableText>
        <Switch
          value={autoPlay}
          onChange={(value) => {
            setAutoPlay(value);

            createNewLottieView();
          }}
        />
      </XStack>
      <XStack gap="$5">
        <Button
          onPress={() => {
            ref.current?.play?.();
          }}
        >
          play
        </Button>
        <Button
          onPress={() => {
            ref.current?.pause?.();
          }}
        >
          pause
        </Button>
        <Button
          onPress={() => {
            ref.current?.reset();
          }}
        >
          reset
        </Button>
      </XStack>
    </YStack>
  );
};

const LocalLottieUploader = () => {
  const [lottieData, setLottieData] = useState<object | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loop, setLoop] = useState(true);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lottieRef = useRef<any>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          setLottieData(json);
          setFileName(file.name);
          setError('');
        } catch {
          setError('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleButtonPress = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback(() => {
    setLottieData(null);
    setFileName('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  if (!platformEnv.isWeb && !platformEnv.isDesktop) {
    return (
      <YStack gap="$4">
        <SizableText color="$textSubdued">
          Local file upload is only available on Web and Desktop
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <XStack gap="$3" flexWrap="wrap">
        <Button onPress={handleButtonPress}>Select Lottie JSON</Button>
        {lottieData ? <Button onPress={handleClear}>Clear</Button> : null}
      </XStack>

      {fileName ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          File: {fileName}
        </SizableText>
      ) : null}

      {error ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {error}
        </SizableText>
      ) : null}

      {lottieData ? (
        <YStack gap="$4">
          <XStack gap="$3" alignItems="center">
            <SizableText>Loop:</SizableText>
            <Switch value={loop} onChange={setLoop} />
          </XStack>

          <XStack gap="$3">
            <Button onPress={() => lottieRef.current?.play?.()}>Play</Button>
            <Button onPress={() => lottieRef.current?.pause?.()}>Pause</Button>
            <Button onPress={() => lottieRef.current?.reset?.()}>Reset</Button>
          </XStack>

          <YStack gap="$2">
            <SizableText size="$headingMd">Light Background</SizableText>
            <Stack
              h={300}
              bg="$bgApp"
              borderRadius="$4"
              justifyContent="center"
              alignItems="center"
              borderWidth={1}
              borderColor="$borderSubdued"
            >
              <LottieView
                ref={lottieRef}
                source={lottieData}
                width={280}
                height={280}
                autoPlay
                loop={loop}
                resizeMode="contain"
              />
            </Stack>
          </YStack>

          <YStack gap="$2">
            <SizableText size="$headingMd">Dark Background</SizableText>
            <Stack
              h={300}
              bg="$bgInverse"
              borderRadius="$4"
              justifyContent="center"
              alignItems="center"
            >
              <LottieView
                source={lottieData}
                width={280}
                height={280}
                autoPlay
                loop={loop}
                resizeMode="contain"
              />
            </Stack>
          </YStack>
        </YStack>
      ) : (
        <Stack
          h={200}
          bg="$bgSubdued"
          borderRadius="$4"
          justifyContent="center"
          alignItems="center"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderStyle="dashed"
        >
          <SizableText color="$textSubdued">
            Select a Lottie JSON file to preview
          </SizableText>
        </Stack>
      )}
    </YStack>
  );
};

const ReferralAnimationsDemo = () => (
  <YStack gap="$8">
    <YStack gap="$2">
      <SizableText size="$headingMd">Referral Light</SizableText>
      <XStack
        h={200}
        bg="$bgApp"
        borderRadius="$4"
        justifyContent="center"
        alignItems="center"
      >
        <LottieView
          width={200}
          height={200}
          autoPlay
          loop
          source={require('@onekeyhq/kit/assets/animations/_mov_refer.json')}
        />
      </XStack>
    </YStack>

    <YStack gap="$2">
      <SizableText size="$headingMd">Referral Dark</SizableText>
      <XStack
        h={200}
        bg="$bgInverse"
        borderRadius="$4"
        justifyContent="center"
        alignItems="center"
      >
        <LottieView
          width={200}
          height={200}
          autoPlay
          loop
          source={require('@onekeyhq/kit/assets/animations/_mov_refer_dark.json')}
        />
      </XStack>
    </YStack>

    <YStack gap="$2">
      <SizableText size="$headingMd">Hardware Referral Light</SizableText>
      <XStack
        h={200}
        bg="$bgApp"
        borderRadius="$4"
        justifyContent="center"
        alignItems="center"
      >
        <LottieView
          width={200}
          height={200}
          autoPlay
          loop
          source={require('@onekeyhq/kit/assets/animations/_mov_referHardware.json')}
        />
      </XStack>
    </YStack>

    <YStack gap="$2">
      <SizableText size="$headingMd">Hardware Referral Dark</SizableText>
      <XStack
        h={200}
        bg="$bgInverse"
        borderRadius="$4"
        justifyContent="center"
        alignItems="center"
      >
        <LottieView
          width={200}
          height={200}
          autoPlay
          loop
          source={require('@onekeyhq/kit/assets/animations/_mov_referHardware_dark.json')}
        />
      </XStack>
    </YStack>
  </YStack>
);

const LottieViewGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="LottieView"
    elements={[
      {
        title: 'Upload Local Lottie',
        element: <LocalLottieUploader />,
      },
      {
        title: 'Referral Animations',
        element: <ReferralAnimationsDemo />,
      },
      {
        title: 'Default',
        element: <LottieDemo />,
      },
    ]}
  />
);

export default LottieViewGallery;
