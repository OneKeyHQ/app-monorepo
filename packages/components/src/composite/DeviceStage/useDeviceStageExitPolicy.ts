import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import {
  DEVICE_STAGE_EXIT_SETTLE_MS,
  attachDeviceStageEscapeOwner,
  isDeviceStageAnsweredStep,
  isDeviceStageMachineWaitStep,
  resolveDeviceStageExitGrant,
  resolveDeviceStageWaitStall,
} from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import type { IDeviceStageKeyEventTargetLike } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IDeviceStageStep } from './type';

/** One machine wait — a stretch on one wait step — reported when it ends. */
export interface IDeviceStageWaitEnd {
  step: IDeviceStageStep;
  durationMs: number;
  stalled: boolean;
  afterAnswer: boolean;
  endedBy: 'next' | 'off';
}

export interface IDeviceStageExitClocks {
  /** When the stage last appeared (an off → on crossing). */
  appearedAt: number;
  /** When the current machine wait began. */
  waitStartedAt: number;
  /** The current wait followed a card the person answered. */
  afterAnswer: boolean;
}

/**
 * The exit policy's clocks (design hard rule #3; the rule itself is
 * resolveDeviceStageExitGrant in shared). The settle clock runs once per
 * appearance of the stage; the stall clock once per machine wait — every
 * step change onto a wait step starts a fresh one, so connecting →
 * processing → connecting is three waits (the step moving IS the device's
 * proof of life, and the legacy dialog's timer restarted per call the
 * same way). A fired stall therefore never outlives the step it fired on:
 * the next flow's connecting, chained inside the off grace, opens clean
 * rather than wearing the "device is silent" hint the previous call
 * earned. A wait that begins right after an answered card is marked so
 * the keys hold with the close, and the mark carries across wait → wait.
 * `activitySeq` is the device's sign of life within a wait: every change
 * restarts the idle deadline, the cap keeps counting
 * (resolveDeviceStageWaitStall).
 *
 * Render-time ref writes on purpose: the grant must read a crossing in
 * the very render that shows the new step, or a close would flash for a
 * frame. Shared by the app's driver and the storybook driver, so the two
 * cannot drift.
 */
export function useDeviceStageExitPolicy({
  step,
  activitySeq = 0,
  onWaitEnded,
}: {
  step: IDeviceStageStep;
  activitySeq?: number;
  onWaitEnded?: (ended: IDeviceStageWaitEnd) => void;
}): {
  closable: boolean;
  exitAllowed: boolean;
  stalled: boolean;
  clocksRef: MutableRefObject<IDeviceStageExitClocks>;
} {
  const [settledAppearance, setSettledAppearance] = useState(0);
  const [stalledWaitRun, setStalledWaitRun] = useState(0);
  const ref = useRef({
    prevStep: 'off' as IDeviceStageStep,
    appearance: 0,
    appearedAt: 0,
    waitRun: 0,
    waitStartedAt: 0,
    lastActivitySeq: 0,
    lastActivityAt: 0,
    afterAnswer: false,
    endedWait: undefined as IDeviceStageWaitEnd | undefined,
  });
  const c = ref.current;
  if (c.prevStep !== step) {
    const now = Date.now();
    if (c.prevStep === 'off') {
      c.appearance += 1;
      c.appearedAt = now;
    }
    const wasWaiting = isDeviceStageMachineWaitStep(c.prevStep);
    const isWaiting = isDeviceStageMachineWaitStep(step);
    if (wasWaiting) {
      c.endedWait = {
        step: c.prevStep,
        durationMs: now - c.waitStartedAt,
        stalled: stalledWaitRun === c.waitRun,
        afterAnswer: c.afterAnswer,
        endedBy: step === 'off' ? 'off' : 'next',
      };
    }
    if (isWaiting) {
      c.waitRun += 1;
      c.waitStartedAt = now;
      c.lastActivityAt = now;
      if (!wasWaiting) {
        c.afterAnswer = isDeviceStageAnsweredStep(c.prevStep);
      }
    }
    c.prevStep = step;
  }
  if (activitySeq !== c.lastActivitySeq) {
    c.lastActivitySeq = activitySeq;
    c.lastActivityAt = Date.now();
  }
  const { appearance, waitRun, afterAnswer } = c;
  const stageOn = step !== 'off';
  const machineWait = isDeviceStageMachineWaitStep(step);
  useEffect(() => {
    if (!stageOn || settledAppearance === appearance) {
      return undefined;
    }
    const timer = setTimeout(
      () => setSettledAppearance(appearance),
      DEVICE_STAGE_EXIT_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [stageOn, appearance, settledAppearance]);
  useEffect(() => {
    if (!machineWait || stalledWaitRun === waitRun) {
      return undefined;
    }
    const { stalled: due, dueInMs } = resolveDeviceStageWaitStall({
      now: Date.now(),
      waitStartedAt: ref.current.waitStartedAt,
      lastActivityAt: ref.current.lastActivityAt,
    });
    if (due) {
      setStalledWaitRun(waitRun);
      return undefined;
    }
    const timer = setTimeout(() => setStalledWaitRun(waitRun), dueInMs);
    return () => clearTimeout(timer);
  }, [machineWait, waitRun, stalledWaitRun, activitySeq]);
  const stalled = machineWait && stalledWaitRun === waitRun;
  const grant = resolveDeviceStageExitGrant({
    step,
    settled: settledAppearance === appearance,
    stalled,
    afterAnswer,
  });
  // The wait that just ended, reported once its successor has rendered.
  const onWaitEndedRef = useRef(onWaitEnded);
  onWaitEndedRef.current = onWaitEnded;
  useEffect(() => {
    const ended = ref.current.endedWait;
    if (!ended) {
      return;
    }
    ref.current.endedWait = undefined;
    onWaitEndedRef.current?.(ended);
  }, [step]);
  return {
    closable: grant.closable,
    exitAllowed: grant.exitAllowed,
    stalled,
    clocksRef: ref,
  };
}

/**
 * Web / desktop: Escape, owned in the capture phase while the stage is
 * on. The shared owner only calls back and never consumes the key by
 * itself, so the Dialog keydown handlers and the modal navigator's keyup
 * handler underneath would otherwise see the press and close what the
 * stage covers. Attached once; the refs keep it reading the live values.
 */
export function useDeviceStageEscapeOwner({
  stageOn,
  onEscape,
}: {
  stageOn: boolean;
  onEscape: () => void;
}) {
  const stageOnRef = useRef(stageOn);
  stageOnRef.current = stageOn;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  useEffect(() => {
    if (
      platformEnv.isNative ||
      typeof globalThis.addEventListener !== 'function'
    ) {
      return undefined;
    }
    return attachDeviceStageEscapeOwner({
      target: globalThis as unknown as IDeviceStageKeyEventTargetLike,
      isStageOn: () => stageOnRef.current,
      onEscape: () => onEscapeRef.current(),
    });
  }, []);
}
