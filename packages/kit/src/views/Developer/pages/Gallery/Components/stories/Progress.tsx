import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  Icon,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function ProgressDemo() {
  const [progress, setProgress] = useState(0);
  return (
    <YStack gap="$2">
      <Progress value={progress} />
      <Button
        onPress={() => {
          setProgress(progress + 10);
        }}
      >
        Increase
      </Button>
    </YStack>
  );
}

function ProgressDialogContent() {
  const dialogInstance = useDialogInstance();
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 1;
        if (newProgress >= 100) {
          setIsDone(true);
          clearInterval(timer);
          return 100;
        }
        return newProgress;
      });
    }, 100); // 10 seconds total (100ms * 100 = 10s)

    return () => clearInterval(timer);
  }, []);

  return (
    <Stack>
      <Stack
        py="$2.5"
        px="$5"
        gap="$5"
        flex={1}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          alignSelf="center"
          w="100%"
          maxWidth="$80"
        >
          <Progress mt="$4" w="100%" size="medium" value={progress} />

          <XStack mt="$5" alignItems="center" gap="$2">
            <SizableText size="$bodyLg" textAlign="center">
              {`Loading... ${progress}%`}
            </SizableText>
          </XStack>

          {isDone ? (
            <Icon
              mt="$5"
              name="CheckRadioSolid"
              size="$12"
              color="$iconSuccess"
            />
          ) : null}
        </Stack>
      </Stack>

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton={isDone}
        confirmButtonProps={{
          variant: 'primary',
        }}
        onConfirmText="Done"
        onConfirm={async () => {
          void dialogInstance.close();
        }}
      />
    </Stack>
  );
}

function showProgressDialog() {
  Dialog.show({
    title: 'Progress Example',
    showExitButton: false,
    dismissOnOverlayPress: false,
    renderContent: <ProgressDialogContent />,
  });
}

const ProgressGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Progress"
    elements={[
      {
        title: 'Interactive Progress Bar',
        element: <ProgressDemo />,
      },
      {
        title: 'Progress Dialog with Timer',
        element: (
          <Button onPress={showProgressDialog}>
            Show Progress Dialog (10s Timer)
          </Button>
        ),
      },
      {
        title: 'Progress Bar Variations',
        element: (
          <YStack gap="$2">
            <Progress animated value={0} w={50} />
            <Progress animated value={10} w={50} />
            <Progress animated value={60} w={50} />
            <Progress animated value={90} w={50} />
            <Progress animated value={100} w={50} />
            <Progress animated value={0.1} />
            <Progress value={60} />
            <Progress value={80} />
            <Progress value={100} />
          </YStack>
        ),
      },
      {
        title: 'Progress Bar Colors',
        element: (
          <YStack gap="$5">
            <Progress progressColor="$textSuccess" value={60} h={20} />
            <Progress indicatorColor="$textSuccess" value={60} h={10} />
          </YStack>
        ),
      },
    ]}
  />
);

export default ProgressGallery;
