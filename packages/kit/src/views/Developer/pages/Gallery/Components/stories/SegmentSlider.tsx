/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useEffect, useRef, useState } from 'react';

import {
  Button,
  SegmentSlider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const Label = ({ children }: { children: React.ReactNode }) => (
  <SizableText size="$bodySm" color="$textSubdued">
    {children}
  </SizableText>
);

const ValuePill = ({
  value,
  suffix = '%',
}: {
  value: number;
  suffix?: string;
}) => (
  <Stack
    px="$2"
    py="$0.5"
    borderRadius="$2"
    bg="$bgStrong"
    alignSelf="flex-start"
  >
    <SizableText size="$bodySm">
      {value}
      {suffix}
    </SizableText>
  </Stack>
);

// -----------------------------------------------------------------------------
// 1. Default — 4 segments, value bubble on drag (matches Perp page tap targets)
// -----------------------------------------------------------------------------
const DefaultDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider value={value} onChange={setValue} segments={4} />
      <Label>
        segments=4 — drag freely (can rest at 37%); only clicking a dot (with
        hover glow) snaps to an exact 0/25/50/75/100. Clicking bare track keeps
        the raw value. Matches Hyperliquid behavior.
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 1b. Tap snaps to nearest segment (native-only snapTapToSegment) — tap anywhere
//     lands on the closest dot; drag still reaches any value (e.g. 26).
// -----------------------------------------------------------------------------
const TapSnapDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={4}
        snapTapToSegment
      />
      <Label>
        snapTapToSegment (native only) — tap at 26 snaps to 25; tap anywhere
        lands on the nearest 0/25/50/75/100. Drag still moves freely to any
        value (26 etc.).
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 2. No bubble — exact Perp panel config
// -----------------------------------------------------------------------------
const NoBubbleDemo = () => {
  const [value, setValue] = useState(50);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={4}
        showBubble={false}
      />
      <Label>showBubble=false (Perp trading panel uses this)</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 3. Initial-at-exact-segment — regression for refresh layout race
//    On reload, the thumb should land exactly on the third dot, NOT drift then
//    correct ~1s later. The "Reload" button forces a remount.
// -----------------------------------------------------------------------------
const RefreshAlignmentDemo = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [value, setValue] = useState(50);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <XStack gap="$2" alignItems="center">
        <ValuePill value={value} />
        <Button
          size="small"
          variant="secondary"
          onPress={() => setReloadKey((k) => k + 1)}
        >
          Remount
        </Button>
      </XStack>
      <SegmentSlider
        key={reloadKey}
        value={value}
        onChange={setValue}
        segments={4}
      />
      <Label>
        Initial value=50 should sit exactly on the third dot at first paint — no
        drift, no settle delay.
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 4. Tap accuracy — tap each visible dot, expect 0/25/50/75/100 every time
// -----------------------------------------------------------------------------
const TapAccuracyDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider value={value} onChange={setValue} segments={4} />
      <Label>
        Hover each dot — glow ring shows it&apos;s clickable. Click it — value
        lands exactly on 0/25/50/75/100. Clicking the track between dots keeps
        the raw click position.
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 5. Force snap to step — value snaps mid-drag, never stops between segments
// -----------------------------------------------------------------------------
const ForceSnapDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={4}
        forceSnapToStep
      />
      <Label>
        forceSnapToStep=true — thumb jumps step-by-step DURING drag (no smooth
        intermediate position). Default mode lets the thumb rest anywhere.
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 6. Custom snap threshold — wider auto-snap zone
// -----------------------------------------------------------------------------
const WideThresholdDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={4}
        snapThreshold={6}
      />
      <Label>
        snapThreshold=6 — DURING drag, when within ±6 of a segment the thumb
        magnetically locks in. Outside the threshold it slides freely.
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 7. High segment count (10)
// -----------------------------------------------------------------------------
const HighSegmentDemo = () => {
  const [value, setValue] = useState(30);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider value={value} onChange={setValue} segments={10} />
      <Label>segments=10 (every 10%)</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 8. Custom range — min/max other than 0..100
// -----------------------------------------------------------------------------
const CustomRangeDemo = () => {
  const [value, setValue] = useState(50);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} suffix="x" />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={5}
        min={1}
        max={100}
      />
      <Label>min=1, max=100, segments=5 (think leverage selector)</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 9. Center origin — symmetric range, fills from center
// -----------------------------------------------------------------------------
const CenterOriginDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} suffix="" />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={10}
        min={-50}
        max={50}
        centerOrigin
      />
      <Label>min=-50, max=50, centerOrigin — fills outward from 0</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 10. Continuous slider (segments=0) — used by ClosePositionModal / SetTpslModal
// -----------------------------------------------------------------------------
const ContinuousDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider value={value} onChange={setValue} segments={0} />
      <Label>segments=0 — no marks, continuous drag (1 unit precision)</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 11. Disabled
// -----------------------------------------------------------------------------
const DisabledDemo = () => (
  <YStack gap="$2" px="$4" py="$3">
    <SegmentSlider
      value={50}
      onChange={() => undefined}
      segments={4}
      disabled
    />
    <Label>disabled — no pointer or keyboard interaction</Label>
  </YStack>
);

// -----------------------------------------------------------------------------
// 12. Slim track (Perp mobile uses sliderHeight=2)
// -----------------------------------------------------------------------------
const SlimDemo = () => {
  const [value, setValue] = useState(40);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={4}
        sliderHeight={2}
      />
      <Label>sliderHeight=2 (Perp mobile config)</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 13. Slide event logging — exercises onSlideStart / onSlideComplete
// -----------------------------------------------------------------------------
const SlideEventDemo = () => {
  const [value, setValue] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const append = (line: string) =>
    setLog((prev) => [line, ...prev].slice(0, 6));
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={(v) => {
          setValue(v);
          append(`change → ${v}`);
        }}
        segments={4}
        onSlideStart={() => append('slide start')}
        onSlideComplete={() => append('slide complete')}
      />
      <YStack
        gap="$0.5"
        bg="$bgSubdued"
        p="$2"
        borderRadius="$2"
        minHeight={80}
      >
        {log.length === 0 ? (
          <Label>Drag the slider to see events…</Label>
        ) : (
          log.map((l, i) => (
            <SizableText key={i.toString()} size="$bodySm">
              {l}
            </SizableText>
          ))
        )}
      </YStack>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 14. Custom thumb / mark
// -----------------------------------------------------------------------------
const CustomRenderDemo = () => {
  const [value, setValue] = useState(25);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <ValuePill value={value} />
      <SegmentSlider
        value={value}
        onChange={setValue}
        segments={4}
        renderThumb={() => (
          <Stack
            w={20}
            h={20}
            borderRadius="$full"
            bg="$bgCriticalStrong"
            borderWidth={2}
            borderColor="$bg"
          />
        )}
        renderMark={({ index }) => (
          <Stack
            w={12}
            h={12}
            borderRadius={2}
            bg={index % 2 === 0 ? '$bgInfoStrong' : '$bgSuccessStrong'}
          />
        )}
      />
      <Label>Custom renderThumb (red circle) + renderMark (square)</Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// 15. External programmatic updates — verifies no fight with internal state
// -----------------------------------------------------------------------------
const ProgrammaticDemo = () => {
  const [value, setValue] = useState(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) {
      if (ticker.current) clearInterval(ticker.current);
      return;
    }
    ticker.current = setInterval(() => {
      setValue((v) => (v >= 100 ? 0 : v + 25));
    }, 800);
    return () => {
      if (ticker.current) clearInterval(ticker.current);
    };
  }, [running]);
  return (
    <YStack gap="$2" px="$4" py="$3">
      <XStack gap="$2" alignItems="center">
        <ValuePill value={value} />
        <Button
          size="small"
          variant={running ? 'destructive' : 'primary'}
          onPress={() => setRunning((r) => !r)}
        >
          {running ? 'Stop' : 'Auto step'}
        </Button>
      </XStack>
      <SegmentSlider value={value} onChange={setValue} segments={4} />
      <Label>
        External setState ticks 0→25→50→75→100. The thumb should follow smoothly
        without flicker.
      </Label>
    </YStack>
  );
};

// -----------------------------------------------------------------------------
// Gallery wiring
// -----------------------------------------------------------------------------
const SegmentSliderGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="SegmentSlider"
    elements={[
      {
        title: 'Default (4 segments, bubble on drag)',
        element: <DefaultDemo />,
      },
      {
        title: 'Tap snaps to nearest segment (native snapTapToSegment)',
        element: <TapSnapDemo />,
      },
      { title: 'No bubble (Perp panel config)', element: <NoBubbleDemo /> },
      {
        title: 'Initial-at-exact-segment (refresh alignment regression)',
        element: <RefreshAlignmentDemo />,
      },
      { title: 'Tap accuracy', element: <TapAccuracyDemo /> },
      { title: 'Force snap to step (web only)', element: <ForceSnapDemo /> },
      {
        title: 'Wide snap threshold (web only)',
        element: <WideThresholdDemo />,
      },
      { title: 'High segment count (10)', element: <HighSegmentDemo /> },
      { title: 'Custom range (1..100)', element: <CustomRangeDemo /> },
      { title: 'Center origin (-50..50)', element: <CenterOriginDemo /> },
      { title: 'Continuous (segments=0)', element: <ContinuousDemo /> },
      { title: 'Disabled', element: <DisabledDemo /> },
      { title: 'Slim track (sliderHeight=2)', element: <SlimDemo /> },
      { title: 'Slide events (start/complete)', element: <SlideEventDemo /> },
      { title: 'Custom thumb & mark', element: <CustomRenderDemo /> },
      {
        title: 'Programmatic external updates',
        element: <ProgrammaticDemo />,
      },
    ]}
  />
);

export default SegmentSliderGallery;
