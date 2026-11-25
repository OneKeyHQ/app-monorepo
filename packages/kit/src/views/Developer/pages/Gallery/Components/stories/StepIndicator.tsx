import { useEffect, useRef, useState } from 'react';

import type { IStepIndicatorItem } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  StepIndicator,
  StepIndicatorMark,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const LABELS = ['Add funds', 'Choose an option', 'Confirm', 'Complete'];

function StepsExample({ inverse = false }: { inverse?: boolean }) {
  const [current, setCurrent] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const steps: IStepIndicatorItem[] = LABELS.map((label, index) => {
    let status: IStepIndicatorItem['status'] = 'upcoming';
    if (index === current) status = 'current';
    else if (index < furthest) status = 'done';
    return {
      id: String(index),
      label,
      status,
      disabled: index > furthest,
    };
  });
  return (
    <YStack width="100%" maxWidth={640} gap="$4">
      <YStack
        testID={
          inverse ? 'step-indicator-inverse-surface' : 'step-indicator-surface'
        }
        p="$5"
        borderRadius="$3"
        bg={inverse ? '#2B6A25' : '$bgSubdued'}
      >
        <StepIndicator
          testID={inverse ? 'step-indicator-inverse' : 'step-indicator-default'}
          steps={steps}
          tone={inverse ? 'inverse' : 'default'}
          currentMarkTextColor={inverse ? '#2B6A25' : undefined}
          onStepPress={(id) => setCurrent(Number(id))}
        />
      </YStack>
      <XStack gap="$3">
        <Button
          testID={
            inverse ? 'step-indicator-inverse-next' : 'step-indicator-next'
          }
          size="small"
          onPress={() => {
            const next = Math.min(current + 1, LABELS.length - 1);
            setCurrent(next);
            setFurthest((value) => Math.max(value, next));
          }}
        >
          Next
        </Button>
        <Button
          testID={
            inverse ? 'step-indicator-inverse-reset' : 'step-indicator-reset'
          }
          size="small"
          onPress={() => {
            setCurrent(0);
            setFurthest(0);
          }}
        >
          Reset
        </Button>
      </XStack>
    </YStack>
  );
}

function MarksExample() {
  return (
    <XStack gap="$5" alignItems="center">
      {(['upcoming', 'current', 'done'] as const).map((status, index) => (
        <XStack key={status} gap="$2" alignItems="center">
          <StepIndicatorMark index={index} status={status} />
          <SizableText size="$bodySm">{status}</SizableText>
        </XStack>
      ))}
    </XStack>
  );
}

function InteractionExample() {
  const [current, setCurrent] = useState('first');
  const [disabled, setDisabled] = useState(false);
  const [interactive, setInteractive] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const steps: IStepIndicatorItem[] = [
    {
      id: 'first',
      label: 'First step',
      status: current === 'first' ? 'current' : 'done',
      disabled,
    },
    {
      id: 'second',
      label: 'Second step',
      status: current === 'second' ? 'current' : 'upcoming',
    },
  ];

  return (
    <YStack width="100%" maxWidth={640} gap="$3">
      <StepIndicator
        testID="step-indicator-interaction"
        steps={steps}
        onStepPress={interactive ? setCurrent : undefined}
      />
      <SizableText testID="step-indicator-interaction-status" size="$bodySm">
        {`${interactive ? 'Interactive' : 'Static'} · First step ${disabled ? 'disabled' : 'enabled'}`}
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          testID="step-indicator-interaction-toggle-disabled"
          size="small"
          onPress={() => {
            clearTimeout(timer.current);
            setDisabled((value) => !value);
          }}
        >
          {disabled ? 'Enable first step' : 'Disable first step'}
        </Button>
        <Button
          testID="step-indicator-interaction-toggle-mode"
          size="small"
          onPress={() => {
            clearTimeout(timer.current);
            setInteractive((value) => !value);
          }}
        >
          {interactive ? 'Use static mode' : 'Use interactive mode'}
        </Button>
        <Button
          testID="step-indicator-interaction-delayed-disable"
          size="small"
          onPress={() => {
            clearTimeout(timer.current);
            setInteractive(true);
            setDisabled(false);
            timer.current = setTimeout(() => setDisabled(true), 2000);
          }}
        >
          Disable in 2 seconds
        </Button>
        <Button
          testID="step-indicator-interaction-delayed-static"
          size="small"
          onPress={() => {
            clearTimeout(timer.current);
            setInteractive(true);
            timer.current = setTimeout(() => setInteractive(false), 2000);
          }}
        >
          Use static mode in 2 seconds
        </Button>
      </XStack>
    </YStack>
  );
}

export default function StepIndicatorGallery() {
  return (
    <Layout
      componentName="StepIndicator"
      wideScreen
      elements={[
        { title: 'Step marks', element: <MarksExample /> },
        { title: 'Interactive indicator', element: <StepsExample /> },
        {
          title: 'Indicator on a colored surface',
          element: (
            <Theme name="dark">
              <StepsExample inverse />
            </Theme>
          ),
        },
        { title: 'Interaction states', element: <InteractionExample /> },
      ]}
    />
  );
}
