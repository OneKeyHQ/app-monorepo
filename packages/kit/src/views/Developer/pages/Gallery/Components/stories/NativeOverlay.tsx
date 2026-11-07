import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { useNavigation } from '@react-navigation/native';
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionList,
  Button,
  Dialog,
  Input,
  Popover,
  Select,
  SizableText,
  Stack,
  Toast,
  Tooltip,
  XStack,
  YStack,
  useInPageDialog,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EGalleryRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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

const independentAnchoredTrigger = (
  <Button testID="independent-anchored-trigger">True anchored Popover</Button>
);
const independentAnchoredPanelProps = { width: 260 };

function IndependentAnchoredContent({
  closePopover,
}: {
  closePopover: () => void;
}) {
  const [count, setCount] = useState(0);
  return (
    <YStack p="$3" gap="$2" testID="independent-anchored-panel">
      <SizableText>Anchored panel</SizableText>
      <Button
        testID="independent-anchored-action"
        onPress={() => setCount((n) => n + 1)}
      >{`Anchored taps ${count}`}</Button>
      <Button testID="independent-anchored-close" onPress={closePopover}>
        Close anchored panel
      </Button>
    </YStack>
  );
}

interface IIndependentEntry {
  name: string;
  visible: boolean;
  presentation: IOverlayPresentation;
  level: IOverlayLevel;
}

let independentMounts = 0;

function IndependentEntry({
  entry,
  close,
  next,
  rapid,
  clear,
  removed,
}: {
  entry: IIndependentEntry;
  close: (name: string) => void;
  next: (name: string) => void;
  rapid: (name: string) => void;
  clear: () => void;
  removed: (name: string, reason: string) => void;
}) {
  const [mount] = useState(() => {
    independentMounts += 1;
    return independentMounts;
  });
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const passive = entry.level === 'toast';
  return (
    <OverlayView
      visible={entry.visible}
      presentation={entry.presentation}
      level={entry.level}
      blocking={!passive}
      dismissOnBackPress={!passive}
      sheet={{
        height: 520,
        showHandle: true,
        backgroundColor: LEVEL_COLORS[entry.level],
      }}
      backdrop={passive ? false : { dismissOnPress: true }}
      onRequestDismiss={() => close(entry.name)}
      onClose={(reason) => removed(entry.name, reason)}
      testID={`independent-overlay-${entry.name}`}
    >
      <YStack
        flex={entry.presentation === 'sheet' ? undefined : 1}
        justifyContent={passive ? 'flex-start' : 'center'}
        pt={passive ? '$16' : undefined}
        alignItems="center"
        pointerEvents="box-none"
      >
        <YStack
          width={passive ? 260 : 340}
          p="$4"
          gap="$2"
          borderRadius="$4"
          bg={LEVEL_COLORS[entry.level]}
        >
          <SizableText
            testID={`independent-title-${entry.name}`}
            color="white"
            size="$headingLg"
          >
            {`${entry.name} · mount ${mount}`}
          </SizableText>
          {!passive ? (
            <>
              <XStack gap="$2" flexWrap="wrap">
                {['A', 'B', 'C'].map((name) => (
                  <Button
                    key={name}
                    testID={`independent-close-${name}-from-${entry.name}`}
                    size="small"
                    onPress={() => close(name)}
                  >{`Close ${name}`}</Button>
                ))}
                <Button
                  testID={`independent-next-${entry.name}`}
                  size="small"
                  onPress={() => next(entry.name)}
                >
                  Next
                </Button>
                <Button
                  testID={`independent-rapid-${entry.name}`}
                  size="small"
                  onPress={() => rapid('C')}
                >
                  Rapid C
                </Button>
                <Button
                  testID={`independent-rapid-lower-${entry.name}`}
                  size="small"
                  onPress={() => rapid('A')}
                >
                  Rapid A
                </Button>
                <Button
                  testID={`independent-clear-${entry.name}`}
                  size="small"
                  onPress={clear}
                >
                  Clear
                </Button>
              </XStack>
              <Input
                testID={`independent-input-${entry.name}`}
                placeholder="Synthetic input"
                value={text}
                onChangeText={setText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                testID={`independent-count-${entry.name}`}
                size="small"
                onPress={() => setCount((n) => n + 1)}
              >{`Count ${count}`}</Button>
              <SizableText
                testID={`independent-scroll-offset-${entry.name}`}
                color="white"
              >{`Scroll ${Math.round(scrollY)}`}</SizableText>
              <ScrollView
                testID={`independent-scroll-${entry.name}`}
                style={{ height: 100 }}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                scrollEventThrottle={32}
                onScroll={(event) =>
                  setScrollY(event.nativeEvent.contentOffset.y)
                }
              >
                {Array.from({ length: 30 }, (_, index) => (
                  <SizableText
                    color="white"
                    key={index}
                  >{`${entry.name} synthetic row ${index + 1}`}</SizableText>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <SizableText color="white">
                Passive toast: keeps its own window
              </SizableText>
              <Button
                testID="independent-toast-count"
                size="small"
                onPress={() => setCount((n) => n + 1)}
              >{`Toast taps ${count}`}</Button>
              <Button
                testID="independent-toast-close"
                size="small"
                onPress={() => close(entry.name)}
              >
                Close toast
              </Button>
            </>
          )}
        </YStack>
      </YStack>
    </OverlayView>
  );
}

function IndependentWindowsRegression({
  children,
}: {
  children: (controls: ReactElement) => ReactElement;
}) {
  const [entries, setEntries] = useState<IIndependentEntry[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [baseTaps, setBaseTaps] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const open = useCallback(
    (
      name: string,
      presentation: IOverlayPresentation = 'sheet',
      level: IOverlayLevel = 'modal',
    ) => {
      setEntries((current) => [
        ...current.filter((entry) => entry.name !== name),
        { name, visible: true, presentation, level },
      ]);
    },
    [],
  );
  const close = useCallback((name: string) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.name === name ? { ...entry, visible: false } : entry,
      ),
    );
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setEntries((current) =>
      current.map((entry) => ({ ...entry, visible: false })),
    );
  }, []);
  const removed = useCallback((name: string, reason: string) => {
    setEvents((current) => [...current.slice(-7), `${name}:${reason}`]);
    setEntries((current) => current.filter((entry) => entry.name !== name));
  }, []);
  const rapid = useCallback(
    (name: string) => {
      close(name);
      for (const [delay, visible] of [
        [40, true],
        [80, false],
        [120, true],
      ] as const) {
        timers.current.push(
          setTimeout(
            () =>
              setEntries((current) =>
                current.map((entry) =>
                  entry.name === name ? { ...entry, visible } : entry,
                ),
              ),
            delay,
          ),
        );
      }
    },
    [close],
  );
  const next = useCallback(
    (name: string) => open(name === 'A' ? 'B' : 'C'),
    [open],
  );
  const dialogChain = useCallback(() => {
    Dialog.confirm({
      title: 'PIN-like confirmation',
      renderContent: (
        <Dialog.Form formProps={{ defaultValues: { pin: '' } }}>
          <Dialog.FormField name="pin" rules={{ required: true }}>
            <Input
              testID="independent-dialog-pin-input"
              placeholder="Synthetic PIN only"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: () => {
        // Open the next Dialog before Footer performs its normal close.
        Dialog.confirm({
          title: 'NFC-like next Dialog',
          renderContent: (
            <Dialog.Form formProps={{ defaultValues: { state: '' } }}>
              <Dialog.FormField name="state">
                <Input
                  testID="independent-dialog-nfc-input"
                  placeholder="Synthetic NFC-like state"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          confirmButtonProps: { testID: 'independent-dialog-next-confirm' },
        });
      },
      confirmButtonProps: { testID: 'independent-dialog-pin-confirm' },
    });
  }, []);
  const dialogLowerClose = useCallback(() => {
    const lower = Dialog.confirm({
      title: 'Dialog lower A',
      renderContent: <Input placeholder="Synthetic lower input" />,
    });
    Dialog.confirm({
      title: 'Dialog survivor B',
      renderContent: (
        <YStack gap="$3">
          <Dialog.Form formProps={{ defaultValues: { survivor: '' } }}>
            <Dialog.FormField name="survivor">
              <Input
                testID="independent-dialog-survivor-input"
                placeholder="Synthetic survivor input"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Dialog.FormField>
          </Dialog.Form>
          <Button
            testID="independent-dialog-close-lower"
            onPress={() => {
              void lower.close();
            }}
          >
            Close lower Dialog A
          </Button>
        </YStack>
      ),
    });
  }, []);
  const controls = (
    <YStack gap="$3">
      <SizableText size="$headingLg">Independent iOS windows</SizableText>
      <Button testID="independent-dialog-chain" onPress={dialogChain}>
        Dialog confirm → next Dialog
      </Button>
      <Button
        testID="independent-dialog-lower-close"
        onPress={dialogLowerClose}
      >
        Dialog lower-close keyboard
      </Button>
      <Popover
        title="True anchored Popover"
        nativePresentation="anchored"
        showHeader={false}
        placement="bottom-start"
        floatingPanelProps={independentAnchoredPanelProps}
        renderTrigger={independentAnchoredTrigger}
        renderContent={IndependentAnchoredContent}
      />
      <XStack gap="$2" flexWrap="wrap">
        <Button testID="independent-open-A" onPress={() => open('A')}>
          Open A
        </Button>
        <Button
          testID="independent-close-during-enter"
          onPress={() => {
            open('C');
            timers.current.push(setTimeout(() => close('C'), 40));
          }}
        >
          Close during enter
        </Button>
        <Button
          testID="independent-open-ABC"
          onPress={() => {
            open('A');
            open('B');
            open('C');
          }}
        >
          A/B/C sheets
        </Button>
        <Button
          testID="independent-open-mixed"
          onPress={() => {
            open('A');
            open('B', 'center');
            open('C');
          }}
        >
          Sheet / center / sheet
        </Button>
        <Button
          testID="independent-open-secure"
          onPress={() => {
            open('A', 'sheet', 'secure');
            open('T', 'toast', 'toast');
            open('C', 'fullscreen', 'lock');
          }}
        >
          Secure / toast / lock
        </Button>
        <Button testID="independent-base-clear" onPress={clear}>
          Clear overlays
        </Button>
      </XStack>
      <Button
        testID="independent-base-target"
        onPress={() => setBaseTaps((n) => n + 1)}
      >{`Base taps ${baseTaps}`}</Button>
      <SizableText testID="independent-events">
        {events.join(' | ') || 'No closes yet'}
      </SizableText>
    </YStack>
  );
  return (
    <>
      {children(controls)}
      {entries.map((entry) => (
        <IndependentEntry
          key={entry.name}
          entry={entry}
          close={close}
          next={next}
          rapid={rapid}
          clear={clear}
          removed={removed}
        />
      ))}
    </>
  );
}

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
        <Button
          testID="native-overlay-demo-close"
          size="small"
          variant="primary"
          onPress={close}
        >
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
      // The lock demo is a dark full-screen surface.
      statusBarStyle={isLock ? 'light' : undefined}
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

// Measures a box inside an overlay once it is presented; the numbers must
// match where the box is on screen.
function MeasureOverlay({
  presentation,
  onClosed,
}: {
  presentation: 'center' | 'sheet' | 'page-sheet';
  onClosed: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [result, setResult] = useState('measuring…');
  const boxRef = useRef<ViewInstance>(null);
  const measure = useCallback(() => {
    boxRef.current?.measureInWindow((x, y, width, height) => {
      setResult(
        `window x=${Math.round(x)} y=${Math.round(y)} w=${Math.round(
          width,
        )} h=${Math.round(height)}`,
      );
    });
  }, []);
  // Re-measure once the keyboard lift settles (native animates it with the
  // keyboard).
  useEffect(() => {
    const remeasure = () => setTimeout(measure, 400);
    const subs = [
      Keyboard.addListener('keyboardDidShow', remeasure),
      Keyboard.addListener('keyboardDidHide', remeasure),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [measure]);
  return (
    <OverlayView
      visible={visible}
      level="modal"
      scope={presentation === 'page-sheet' ? 'page' : 'global'}
      presentation={presentation === 'center' ? 'center' : 'sheet'}
      backdrop={{ dismissOnPress: true }}
      onPresented={measure}
      onClose={onClosed}
    >
      <YStack
        alignSelf={presentation === 'center' ? 'center' : undefined}
        mt={presentation === 'center' ? 420 : undefined}
        width={presentation === 'center' ? 300 : undefined}
        p="$5"
        gap="$3"
        bg="$bg"
        borderRadius="$4"
      >
        <View
          ref={boxRef}
          testID="measure-box"
          style={{ height: 40, backgroundColor: '#e11d48' }}
        />
        <SizableText testID="measure-result">{result}</SizableText>
        <Input
          testID="measure-input"
          placeholder="Focus to open the keyboard"
        />
        <View
          testID="measure-bottom"
          style={{ height: 16, backgroundColor: '#2563eb' }}
        />
        <XStack gap="$2">
          <Button size="small" onPress={measure}>
            Measure again
          </Button>
          <Button size="small" onPress={() => setVisible(false)}>
            Close
          </Button>
        </XStack>
      </YStack>
    </OverlayView>
  );
}

// Dev only: lock the app for a few seconds, then unlock without the
// passcode. Needs a wallet that has a passcode.
async function lockBriefly() {
  const { servicePassword } = backgroundApiProxy;
  if (!(await servicePassword.checkPasswordSet())) {
    Toast.message({ title: 'Set a passcode first' });
    return;
  }
  await timerUtils.wait(800);
  await servicePassword.lockApp({ manual: true });
  await timerUtils.wait(4000);
  await servicePassword.unLockApp();
}

// Every Dialog now renders in the native overlay (P4c).
function DialogIntrinsicHeightContent() {
  const [selected, setSelected] = useState('None');

  return (
    <YStack flex={1} testID="native-overlay-dialog-intrinsic-outer">
      <YStack flex={1} testID="native-overlay-dialog-intrinsic-inner">
        <Input
          testID="native-overlay-dialog-intrinsic-input"
          placeholder="Type here"
        />
        {['Ledger', 'Trezor', 'Keystone'].map((device) => (
          <ListItem
            key={device}
            testID={`native-overlay-dialog-intrinsic-${device.toLowerCase()}`}
            title={device}
            drillIn
            onPress={() => setSelected(device)}
          />
        ))}
        <SizableText testID="native-overlay-dialog-intrinsic-selection">
          {`Selected: ${selected}`}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function DialogDemos() {
  const inPageDialog = useInPageDialog();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  return (
    <XStack gap="$2" flexWrap="wrap">
      <Button
        testID="native-overlay-dialog-open"
        onPress={() =>
          Dialog.confirm({
            title: 'Dialog.confirm',
            description: 'Centered on wide windows, a sheet on phones.',
            onConfirm: () => undefined,
          })
        }
      >
        Dialog.confirm
      </Button>
      <Button
        testID="native-overlay-form-dialog-open"
        onPress={() =>
          Dialog.show({
            title: 'Form dialog',
            renderContent: (
              <Input testID="dialog-form-input" placeholder="Type here" />
            ),
            onConfirm: () => undefined,
          })
        }
      >
        Form dialog
      </Button>
      <Button
        testID="native-overlay-intrinsic-dialog-open"
        onPress={() =>
          Dialog.show({
            title: 'Intrinsic height',
            renderContent: <DialogIntrinsicHeightContent />,
            showFooter: false,
          })
        }
      >
        Flex content and list
      </Button>
      <Button
        onPress={() =>
          inPageDialog.show({
            title: 'In-page dialog',
            description: 'Bound to this page: pushing a page hides it.',
            onConfirmText: 'Push page',
            onConfirm: ({ preventClose }) => {
              preventClose();
              navigation.navigate(EGalleryRoutes.ComponentPortal);
            },
          })
        }
      >
        In-page dialog
      </Button>
      <Button
        onPress={() =>
          Dialog.show({
            title: 'Wide panel',
            description: 'floatingPanelProps width 480',
            floatingPanelProps: { width: 480 },
            onConfirm: () => undefined,
          })
        }
      >
        Wide panel
      </Button>
      <Button
        onPress={() => {
          Dialog.confirm({
            title: 'Dialog under the lock',
            description: 'Stays open under the lock screen and after unlock.',
            onConfirm: () => undefined,
          });
          void lockBriefly();
        }}
      >
        Dialog + lock 4s
      </Button>
      <Button
        testID="native-overlay-scroll-dialog-open"
        onPress={() =>
          Dialog.show({
            title: 'Scroll view',
            renderContent: (
              <Dialog.ScrollView maxHeight={240}>
                {Array.from({ length: 30 }, (_, i) => (
                  <SizableText key={i}>{`Row ${i + 1}`}</SizableText>
                ))}
              </Dialog.ScrollView>
            ),
            onConfirm: () => undefined,
          })
        }
      >
        Dialog.ScrollView
      </Button>
    </XStack>
  );
}

const SELECT_ITEMS = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Beta', value: 'beta' },
  { label: 'Gamma', value: 'gamma' },
];

function SelectDemo({ testID = 'native-overlay-select' }: { testID?: string }) {
  const [value, setValue] = useState('alpha');
  return (
    <Stack width={160}>
      <Select
        title="Select"
        items={SELECT_ITEMS}
        value={value}
        onChange={setValue}
        testID={testID}
      />
    </Stack>
  );
}

// A popover opened from a secure-level overlay must open at that level.
function SecurePopoverDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button
        testID="native-overlay-secure-open"
        onPress={() => setVisible(true)}
      >
        Popover in secure
      </Button>
      <OverlayView
        visible={visible}
        level="secure"
        backdrop={{ dismissOnPress: true }}
        onRequestDismiss={() => setVisible(false)}
      >
        <YStack
          alignSelf="center"
          mt="auto"
          mb="auto"
          p="$5"
          gap="$3"
          bg="$bg"
          borderRadius="$4"
        >
          <SizableText>Secure overlay</SizableText>
          <Popover
            title="Nested popover"
            renderTrigger={
              <Button testID="native-overlay-secure-popover-open">
                Nested popover
              </Button>
            }
            renderContent={
              <YStack p="$5">
                <SizableText>Above the secure overlay</SizableText>
              </YStack>
            }
          />
          <Tooltip
            renderTrigger={<Button>Nested tooltip</Button>}
            renderContent="Tooltip above the secure overlay"
          />
          <Button
            testID="native-overlay-secure-close"
            onPress={() => setVisible(false)}
          >
            Close
          </Button>
        </YStack>
      </OverlayView>
    </>
  );
}

function NativeOverlayDemo() {
  const [specs, setSpecs] = useState<IDemoSpec[]>([]);
  const [matrixOrder, setMatrixOrder] = useState('');
  const [taps, setTaps] = useState(0);
  const [measureMode, setMeasureMode] = useState<
    'center' | 'sheet' | 'page-sheet'
  >();
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
          testID="native-overlay-sheet-open"
          onPress={() => open(makeSpec('modal', { presentation: 'sheet' }))}
        >
          Sheet
        </Button>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          onPress={() =>
            Toast.success({ title: 'Toast.success in the toast level' })
          }
        >
          Toast.success
        </Button>
        <Button
          onPress={() => {
            const toast = Toast.show({
              children: (
                <YStack p="$5" gap="$3">
                  <SizableText>Toast.show custom content</SizableText>
                  <Button size="small" onPress={() => void toast.close()}>
                    Close
                  </Button>
                </YStack>
              ),
            });
          }}
        >
          Toast.show
        </Button>
        <Button
          onPress={() => {
            const toast = Toast.show({
              disableSwipeGesture: true,
              dismissOnOverlayPress: false,
              children: (
                <YStack p="$5" gap="$3">
                  <SizableText>No swipe, no outside tap</SizableText>
                  <Button size="small" onPress={() => void toast.close()}>
                    Close
                  </Button>
                </YStack>
              ),
            });
          }}
        >
          Toast.show (locked)
        </Button>
        <Button
          onPress={() => {
            Dialog.show({
              title: 'Legacy dialog',
              description: 'A toast opens above it in 500 ms.',
              onConfirm: () => undefined,
            });
            setTimeout(() => {
              Toast.message({ title: 'Toast above the dialog' });
              Toast.show({
                children: (
                  <SizableText p="$5">
                    Custom toast above the dialog
                  </SizableText>
                ),
              });
            }, 500);
          }}
        >
          Dialog + toasts
        </Button>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          onPress={() => {
            appEventBus.emit(EAppEventBusNames.ShowDialogLoading, {
              title: 'Loading step 1',
            });
            setTimeout(() => {
              appEventBus.emit(EAppEventBusNames.ShowDialogLoading, {
                title: 'Loading step 2',
              });
            }, 1500);
            setTimeout(() => {
              appEventBus.emit(EAppEventBusNames.HideDialogLoading, undefined);
            }, 3000);
          }}
        >
          DialogLoading
        </Button>
        <Button
          onPress={() => {
            Dialog.show({
              title: 'Legacy dialog',
              description: 'Loading opens above it, then hides.',
              onConfirm: () => undefined,
            });
            setTimeout(() => {
              appEventBus.emit(EAppEventBusNames.ShowDialogLoading, {
                title: 'Loading above the dialog',
              });
            }, 500);
            setTimeout(() => {
              appEventBus.emit(EAppEventBusNames.HideDialogLoading, undefined);
            }, 2500);
          }}
        >
          Dialog + loading
        </Button>
      </XStack>
      <DialogDemos />
      <XStack gap="$2" flexWrap="wrap">
        <Button onPress={() => setMeasureMode('center')}>Measure center</Button>
        <Button onPress={() => setMeasureMode('sheet')}>Measure sheet</Button>
        <Button onPress={() => setMeasureMode('page-sheet')}>
          Measure page sheet
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
          title="ActionList (default)"
          items={[
            {
              label: 'Show a toast',
              onPress: () => {
                Toast.success({ title: 'ActionList item' });
              },
            },
            { label: 'Second item', onPress: () => undefined },
          ]}
          renderTrigger={
            <Button testID="native-overlay-actionlist-open">
              ActionList (default)
            </Button>
          }
        />
        <Popover
          title="Popover title"
          description="Popover description"
          renderTrigger={
            <Button testID="native-overlay-popover-open">Popover</Button>
          }
          renderContent={
            <YStack p="$5" gap="$2">
              {Array.from({ length: 6 }, (_, i) => (
                <SizableText key={i}>{`Popover row ${i + 1}`}</SizableText>
              ))}
              <SelectDemo testID="native-overlay-nested-select" />
            </YStack>
          }
        />
        <SelectDemo />
        <Tooltip
          renderTrigger={<Button>Tooltip</Button>}
          renderContent="Plain tooltip"
          placement="top"
        />
        <Tooltip
          hovering
          renderTrigger={<Button>Hovering tooltip</Button>}
          renderContent={
            <Button
              size="small"
              onPress={() => Toast.success({ title: 'Tooltip button' })}
            >
              Tooltip action
            </Button>
          }
        />
        <SecurePopoverDemo />
        <Popover
          title="Hover popover"
          hoverable
          usingSheet={false}
          placement="top-start"
          renderTrigger={
            <Button testID="native-overlay-hover-popover-open">
              Hover popover
            </Button>
          }
          renderContent={
            <YStack p="$5">
              <SizableText>Opened by hover</SizableText>
            </YStack>
          }
        />
        <ActionList
          title="ActionList opening overlays"
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
          renderTrigger={<Button>ActionList + overlays</Button>}
        />
      </XStack>
      <SizableText>Last matrix order: {matrixOrder || '-'}</SizableText>
      <SizableText>
        Expected bottom → top: modal → hardware → secure → toast → lock
      </SizableText>
      <Button onPress={() => setTaps((n) => n + 1)}>
        {`Pass-through target (taps: ${taps})`}
      </Button>
      {measureMode ? (
        <MeasureOverlay
          key={measureMode}
          presentation={measureMode}
          onClosed={() => setMeasureMode(undefined)}
        />
      ) : null}
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

const NativeOverlayGallery = () => {
  const renderGallery = (controls?: ReactElement) => (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="NativeOverlay"
      elements={[
        ...(controls
          ? [{ title: 'Independent window regression', element: controls }]
          : []),
        {
          title: 'Level ordering / strategies',
          element: <NativeOverlayDemo />,
        },
      ]}
    />
  );
  return Platform.OS === 'ios' ? (
    <IndependentWindowsRegression>{renderGallery}</IndependentWindowsRegression>
  ) : (
    renderGallery()
  );
};

export default NativeOverlayGallery;
