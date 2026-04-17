import { createTransferStateMachine } from '../core/prime-transfer/transfer-state-machine';

describe('createTransferStateMachine', () => {
  it('tracks pairing, paired, and receiving states with reusable status messages', async () => {
    const machine = createTransferStateMachine({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
    });
    const statuses: string[] = [];

    const unsubscribe = machine.subscribe((state) => {
      statuses.push(state.status);
    });

    expect(machine.getState()).toMatchObject({
      event: 'pairing_started',
      status: 'pairing',
      isTerminal: false,
    });

    machine.transition('pairing_verified');

    const receivingStatePromise = machine.waitForState(
      (state) => state.status === 'receiving',
    );

    machine.transition('transfer_receiving');

    await expect(receivingStatePromise).resolves.toMatchObject({
      event: 'transfer_receiving',
      status: 'receiving',
      isTerminal: false,
    });

    machine.transition('transfer_completed');

    expect(machine.getState()).toMatchObject({
      event: 'transfer_completed',
      status: 'completed',
      isTerminal: true,
    });
    expect(statuses).toEqual(['pairing', 'paired', 'receiving', 'completed']);

    unsubscribe();
  });

  it('ignores transitions after reaching a terminal state', () => {
    const machine = createTransferStateMachine({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
    });

    machine.transition('transfer_failed');
    const terminalState = machine.getState();
    machine.transition('transfer_completed');

    expect(machine.getState()).toEqual(terminalState);
  });

  it('keeps timeout as the final terminal state even if late events arrive', () => {
    const machine = createTransferStateMachine({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
    });

    machine.transition('transfer_timeout');
    machine.transition('transfer_completed');

    expect(machine.getState()).toMatchObject({
      event: 'transfer_timeout',
      status: 'timeout',
      isTerminal: true,
    });
  });
});
