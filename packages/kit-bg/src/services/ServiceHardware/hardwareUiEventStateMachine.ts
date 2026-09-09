import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

export type IHardwareUiEventPhase =
  | 'idle'
  | 'pin'
  | 'processing'
  | 'passphrase'
  | 'passphrase-on-device'
  | 'button'
  | 'closed';

type IHardwareUiInteractionMeta = {
  interactionId: string;
  phaseId: string;
  sequence: number;
  phase:
    | 'pin'
    | 'passphrase'
    | 'passphrase-on-device'
    | 'button'
    | 'processing';
  transition: 'start' | 'complete' | 'finish';
  protocol: 'V2';
};

export type IHardwareUiEventState = {
  phase: IHardwareUiEventPhase;
  connectId?: string;
  interactionId?: string;
  phaseId?: string;
  lastSequence?: number;
};

type IReduceHardwareUiEventParams = {
  type: EHardwareUiStateAction;
  renderAction: EHardwareUiStateAction;
  connectId?: string;
  payload?: unknown;
};

export type IHardwareUiEventReduction = {
  state: IHardwareUiEventState;
  applied: boolean;
  action?: EHardwareUiStateAction;
  connectId?: string;
  shouldClearUiState?: boolean;
  /** The ask this event ends was answered on the device — the reduction
   * renders as plain progress, so without this flag nothing downstream can
   * tell it apart from the ticks that merely refresh a wait. */
  askCompleted?: boolean;
};

const REQUEST_PHASES: Partial<
  Record<EHardwareUiStateAction, IHardwareUiEventPhase>
> = {
  [EHardwareUiStateAction.REQUEST_PIN]: 'pin',
  [EHardwareUiStateAction.REQUEST_PASSPHRASE]: 'passphrase',
  [EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE]: 'passphrase-on-device',
  [EHardwareUiStateAction.REQUEST_BUTTON]: 'button',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const getInteraction = (
  payload: unknown,
): IHardwareUiInteractionMeta | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }
  const candidate = isRecord(payload.interaction)
    ? payload.interaction
    : payload;
  if (
    typeof candidate.interactionId !== 'string' ||
    typeof candidate.phaseId !== 'string' ||
    typeof candidate.sequence !== 'number' ||
    candidate.protocol !== 'V2'
  ) {
    return undefined;
  }
  return candidate as IHardwareUiInteractionMeta;
};

const getPayloadConnectId = (payload: unknown): string | undefined => {
  if (!isRecord(payload) || !isRecord(payload.device)) {
    return undefined;
  }
  return typeof payload.device.connectId === 'string'
    ? payload.device.connectId
    : undefined;
};

const isSameDevice = (
  state: IHardwareUiEventState,
  connectId: string | undefined,
) => !state.connectId || !connectId || state.connectId === connectId;

const isNewerEvent = (
  state: IHardwareUiEventState,
  interaction: IHardwareUiInteractionMeta | undefined,
) => {
  if (!interaction) {
    return true;
  }
  if (
    state.interactionId &&
    state.interactionId !== interaction.interactionId
  ) {
    return true;
  }
  return (
    state.lastSequence === undefined ||
    interaction.sequence > state.lastSequence
  );
};

const applyInteraction = (
  state: IHardwareUiEventState,
  interaction: IHardwareUiInteractionMeta | undefined,
): IHardwareUiEventState => {
  if (!interaction) {
    return state;
  }
  return {
    ...state,
    interactionId: interaction.interactionId,
    phaseId: interaction.phaseId,
    lastSequence: interaction.sequence,
  };
};

export const createHardwareUiEventState = (): IHardwareUiEventState => ({
  phase: 'idle',
});

export const reduceHardwareUiEventState = (
  state: IHardwareUiEventState,
  event: IReduceHardwareUiEventParams,
): IHardwareUiEventReduction => {
  const interaction = getInteraction(event.payload);
  const connectId =
    event.connectId ?? getPayloadConnectId(event.payload) ?? state.connectId;
  const requestedPhase = REQUEST_PHASES[event.type];
  const isFirmwareStatusEvent =
    event.type === EHardwareUiStateAction.FIRMWARE_TIP ||
    event.type === EHardwareUiStateAction.FIRMWARE_PROGRESS;
  const isDifferentDevice =
    Boolean(state.connectId) &&
    Boolean(connectId) &&
    state.connectId !== connectId;
  const canSwitchDevice =
    isDifferentDevice &&
    (state.phase === 'closed' ||
      Boolean(requestedPhase) ||
      isFirmwareStatusEvent);
  const currentState = canSwitchDevice
    ? { ...createHardwareUiEventState(), connectId }
    : state;
  const isCloseEvent =
    event.type === EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW ||
    event.type === EHardwareUiStateAction.CLOSE_UI_WINDOW;

  if (
    (isCloseEvent &&
      !interaction &&
      Boolean(currentState.interactionId) &&
      currentState.phase !== 'closed') ||
    !isSameDevice(currentState, connectId) ||
    !isNewerEvent(currentState, interaction)
  ) {
    return { state, applied: false };
  }

  if (requestedPhase) {
    const nextState = applyInteraction(
      {
        ...currentState,
        phase: requestedPhase,
        connectId,
      },
      interaction,
    );
    return {
      state: nextState,
      applied: true,
      action: event.renderAction,
      connectId,
    };
  }

  if (event.type === EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW) {
    const phaseMatches = currentState.phase === 'pin';
    const interactionMatches = interaction
      ? interaction.phase === 'pin' &&
        (!currentState.interactionId ||
          currentState.interactionId === interaction.interactionId) &&
        (!currentState.phaseId || currentState.phaseId === interaction.phaseId)
      : true;
    if (!phaseMatches || !interactionMatches) {
      return { state, applied: false };
    }

    const nextState = applyInteraction(
      {
        ...currentState,
        phase: 'processing',
      },
      interaction,
    );
    return {
      state: nextState,
      applied: true,
      action: EHardwareUiStateAction.ProcessLoading,
      connectId,
      askCompleted: true,
    };
  }

  if (event.type === EHardwareUiStateAction.CLOSE_UI_WINDOW) {
    if (
      interaction &&
      currentState.interactionId &&
      currentState.interactionId !== interaction.interactionId
    ) {
      return { state, applied: false };
    }
    return {
      state: applyInteraction(
        {
          ...currentState,
          phase: 'closed',
        },
        interaction,
      ),
      applied: true,
      action: event.renderAction,
      connectId,
      shouldClearUiState: Boolean(interaction),
    };
  }

  return {
    state: currentState,
    applied: true,
    action: event.renderAction,
    connectId,
  };
};

export class HardwareUiEventQueue<TEvent> {
  private tail: Promise<void> = Promise.resolve();

  private generation = 0;

  enqueue(
    event: TEvent,
    handler: (
      event: TEvent,
      context: { isCurrent: () => boolean },
    ) => void | Promise<void>,
  ): Promise<void> {
    const generation = this.generation;
    const isCurrent = () => generation === this.generation;
    const task = this.tail.then(async () => {
      if (!isCurrent()) {
        return;
      }
      await handler(event, { isCurrent });
    });
    this.tail = task.catch(() => undefined);
    return task;
  }

  reset() {
    this.generation += 1;
    this.tail = Promise.resolve();
  }
}
