import { useCallback, useRef, useState } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionList,
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EGalleryRoutes } from '@onekeyhq/shared/src/routes';

import { Layout } from './utils/Layout';

import type {
  IOverlayLevel,
  IOverlayPresentation,
  IOverlayScope,
  IOverlayStrategy,
} from '@onekeyfe/react-native-native-overlay';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

interface IDemoSpec {
  key: string;
  label: string;
  level: IOverlayLevel;
  presentation: IOverlayPresentation;
  strategy?: IOverlayStrategy;
  priority?: number;
  replaceKey?: string;
  scope?: IOverlayScope;
  color: string;
}

const LEVEL_COLORS: Record<IOverlayLevel, string> = {
  modal: '#3b82f6',
  hardware: '#f59e0b',
  secure: '#10b981',
  toast: '#8b5cf6',
  lock: '#111827',
  debug: '#ef4444',
};

let demoSeq = 0;

function makeSpec(
  level: IOverlayLevel,
  extra: Partial<IDemoSpec> = {},
): IDemoSpec {
  demoSeq += 1;
  let presentation: IOverlayPresentation = 'center';
  if (level === 'toast') {
    presentation = 'toast';
  } else if (level === 'lock') {
    presentation = 'fullscreen';
  }
  const scopeLabel = extra.scope === 'page' ? 'page ' : '';
  return {
    key: `demo-${demoSeq}`,
    label: `${scopeLabel}${level} #${demoSeq}`,
    level,
    presentation,
    color: LEVEL_COLORS[level],
    ...extra,
  };
}

function DemoOverlay({
  spec,
  onOpen,
  onClosed,
}: {
  spec: IDemoSpec;
  onOpen: (spec: IDemoSpec) => void;
  onClosed: (key: string) => void;
}) {
  const [visible, setVisible] = useState(true);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const pushPage = useCallback(
    () => navigation.navigate(EGalleryRoutes.ComponentPortal),
    [navigation],
  );
  const close = useCallback(() => setVisible(false), []);
  const isLock = spec.level === 'lock';
  const isToast = spec.level === 'toast';

  let body = (
    <YStack
      width={300}
      p="$5"
      gap="$3"
      borderRadius="$4"
      backgroundColor={spec.color}
    >
      <SizableText size="$headingLg" color="white">
        {spec.label}
      </SizableText>
      <SizableText color="white">
        {spec.strategy ?? 'stack'}
        {spec.priority ? ` · priority ${spec.priority}` : ''}
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        <Button size="small" onPress={() => onOpen(makeSpec('modal'))}>
          + modal
        </Button>
        <Button size="small" onPress={() => onOpen(makeSpec('toast'))}>
          + toast
        </Button>
        <Button size="small" onPress={() => onOpen(makeSpec('secure'))}>
          + secure
        </Button>
        {spec.scope === 'page' ? (
          <Button size="small" onPress={pushPage}>
            Push page
          </Button>
        ) : null}
        <Button size="small" variant="primary" onPress={close}>
          Close
        </Button>
      </XStack>
    </YStack>
  );
  if (isToast) {
    body = (
      <XStack
        width={320}
        px="$4"
        py="$3"
        gap="$3"
        borderRadius="$3"
        alignItems="center"
        backgroundColor={spec.color}
      >
        <SizableText flex={1} color="white">
          {spec.label}
        </SizableText>
        <Button size="small" onPress={close}>
          Close
        </Button>
      </XStack>
    );
  }
  if (isLock) {
    body = (
      <YStack gap="$4" alignItems="center">
        <SizableText size="$heading2xl" color="white">
          Locked
        </SizableText>
        <Button variant="primary" onPress={close}>
          Unlock
        </Button>
      </YStack>
    );
  }

  if (spec.presentation === 'sheet') {
    return (
      <OverlayView
        visible={visible}
        scope={spec.scope}
        level={spec.level}
        presentation="sheet"
        sheet={{ showHandle: true, backgroundColor: spec.color }}
        backdrop={{ dismissOnPress: true }}
        onRequestDismiss={close}
        onClose={() => onClosed(spec.key)}
        testID={`native-overlay-${spec.key}`}
      >
        <YStack p="$5" pt="$8" gap="$3" pb={insets.bottom + 16}>
          <SizableText size="$headingLg" color="white">
            {spec.label}
          </SizableText>
          <Input placeholder="Keyboard avoidance" />
          <XStack gap="$2" flexWrap="wrap">
            <Button size="small" onPress={() => onOpen(makeSpec('modal'))}>
              + center modal
            </Button>
            <Button
              size="small"
              onPress={() =>
                onOpen(makeSpec('hardware', { presentation: 'sheet' }))
              }
            >
              + hardware sheet
            </Button>
            <Button size="small" onPress={() => onOpen(makeSpec('toast'))}>
              + toast
            </Button>
            <Button size="small" variant="primary" onPress={close}>
              Close
            </Button>
          </XStack>
        </YStack>
      </OverlayView>
    );
  }

  let justifyContent: 'center' | 'flex-start' = 'center';
  if (isToast) {
    justifyContent = 'flex-start';
  }

  return (
    <OverlayView
      visible={visible}
      scope={spec.scope}
      level={spec.level}
      presentation={spec.presentation}
      strategy={spec.strategy}
      priority={spec.priority}
      replaceKey={spec.replaceKey}
      backdrop={isToast || isLock ? false : { dismissOnPress: true }}
      dismissOnBackPress={!isLock}
      animation={
        isLock
          ? {
              enter: { type: 'none' },
              exit: { type: 'fade', motion: 'lockFade' },
            }
          : undefined
      }
      onRequestDismiss={close}
      onClose={() => onClosed(spec.key)}
      testID={`native-overlay-${spec.key}`}
    >
      <Stack
        flex={1}
        alignItems="center"
        justifyContent={justifyContent}
        pt={isToast ? insets.top + 8 : 0}
        pointerEvents="box-none"
        backgroundColor={isLock ? spec.color : undefined}
      >
        {body}
      </Stack>
    </OverlayView>
  );
}

const MATRIX_LEVELS: IOverlayLevel[] = [
  'modal',
  'hardware',
  'secure',
  'toast',
  'lock',
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function NativeOverlayDemo() {
  const [specs, setSpecs] = useState<IDemoSpec[]>([]);
  const [matrixOrder, setMatrixOrder] = useState('');
  const [taps, setTaps] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const open = useCallback((spec: IDemoSpec) => {
    setSpecs((current) => [...current, spec]);
  }, []);
  const onClosed = useCallback((key: string) => {
    setSpecs((current) => current.filter((spec) => spec.key !== key));
  }, []);

  const runMatrix = useCallback(() => {
    const order = shuffle(MATRIX_LEVELS);
    setMatrixOrder(order.join(' → '));
    order.forEach((level, index) => {
      timers.current.push(setTimeout(() => open(makeSpec(level)), index * 250));
    });
  }, [open]);

  const runQueue = useCallback(() => {
    open(makeSpec('hardware', { strategy: 'queue', label: 'queue A' }));
    open(makeSpec('hardware', { strategy: 'queue', label: 'queue B' }));
    open(
      makeSpec('hardware', {
        strategy: 'queue',
        priority: 10,
        label: 'queue C (urgent)',
      }),
    );
  }, [open]);

  const runReplace = useCallback(() => {
    [0, 1, 2].forEach((step) => {
      timers.current.push(
        setTimeout(
          () =>
            open(
              makeSpec('modal', {
                strategy: 'replace',
                replaceKey: 'loading',
                label: `loading step ${step + 1}`,
              }),
            ),
          step * 900,
        ),
      );
    });
  }, [open]);

  return (
    <YStack gap="$3">
      <XStack gap="$2" flexWrap="wrap">
        {MATRIX_LEVELS.map((level) => (
          <Button key={level} onPress={() => open(makeSpec(level))}>
            {level}
          </Button>
        ))}
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button variant="primary" onPress={runMatrix}>
          Matrix (random order)
        </Button>
        <Button onPress={runQueue}>Queue ×3</Button>
        <Button onPress={runReplace}>Replace ×3</Button>
        <Button
          onPress={() => open(makeSpec('modal', { presentation: 'sheet' }))}
        >
          Sheet
        </Button>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          onPress={() =>
            Dialog.show({
              title: 'Dialog via nativeSheet',
              description:
                'Rendered by NativeSheetPresentation on top of OverlayView.',
              nativeSheet: true,
              onConfirm: () => undefined,
            })
          }
        >
          Dialog (nativeSheet)
        </Button>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button onPress={() => open(makeSpec('modal', { scope: 'page' }))}>
          Page dialog
        </Button>
        <Button
          onPress={() =>
            open(makeSpec('modal', { scope: 'page', presentation: 'sheet' }))
          }
        >
          Page sheet
        </Button>
        <Button onPress={() => open(makeSpec('toast', { scope: 'page' }))}>
          Page toast
        </Button>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <ActionList
          title="ActionList via nativeSheet"
          nativeSheet
          items={[
            {
              label: 'Open toast overlay',
              onPress: () => open(makeSpec('toast')),
            },
            {
              label: 'Open secure overlay',
              onPress: () => open(makeSpec('secure')),
            },
          ]}
          renderTrigger={<Button>ActionList (nativeSheet)</Button>}
        />
      </XStack>
      <SizableText>Last matrix order: {matrixOrder || '-'}</SizableText>
      <SizableText>
        Expected bottom → top: modal → hardware → secure → toast → lock
      </SizableText>
      <Button onPress={() => setTaps((n) => n + 1)}>
        {`Pass-through target (taps: ${taps})`}
      </Button>
      {specs.map((spec) => (
        <DemoOverlay
          key={spec.key}
          spec={spec}
          onOpen={open}
          onClosed={onClosed}
        />
      ))}
    </YStack>
  );
}

const NativeOverlayGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="NativeOverlay"
    elements={[
      {
        title: 'Level ordering / strategies',
        element: <NativeOverlayDemo />,
      },
    ]}
  />
);

export default NativeOverlayGallery;
