/**
 * ActionCompiler - Resolves contexts and prepares actions for execution.
 *
 * Context resolution order:
 * 1. Registry (provided via options)
 * 2. OpenChannelActions in the same batch (compute channel with nonce=0)
 * 3. AutoSetup (implicitly create OpenChannelAction)
 * 4. Discovery (call discovery service)
 *
 * After compilation:
 * - Registry is updated with resolved channels and notes
 * - Actions may have UseNoteActions added (if autoSelectNotes)
 * - ClientAction[] is produced with all context "unwrapped"
 *
 * Note: After pool execution, use applyOptimisticUpdate() from registry-updater.ts
 * to update the registry with the results.
 */

import type {
  Actions,
  Amount,
  DiscoveryProviderInterface,
  ExecuteOptions,
  InvokeCalldataBuilderArgs,
  Note,
  PrivateRegistry,
  StarknetAddressBigint,
  ViewingKey,
  Warning,
} from "../interfaces";
import { Channel, createEmptyRegistry, WarningCode } from "../interfaces";
import { AddressMap, AdvancedMap, toBigInt } from "../utils/index";
import type { ClientAction } from "./client-actions";
import { PoolSimulator } from "./pool-simulator";

import { assert, isOpen, isOpenNote } from "../utils/validation";
import { CallData } from "starknet";
import type { BigNumberish } from "starknet";
import { generateRandom, generateRandom120 } from "../utils/crypto";
import { debugLog } from "../utils/logging";
import { toHex } from "../utils/convert";
import { compute_note_id } from "../utils/hashes";
import { ReorgError } from "./errors";

export type CompileResult = {
  clientActions: ClientAction[];
  registry: PrivateRegistry;
  warnings: Warning[];
};

type ClientActions = {
  setViewingKey?: Extract<ClientAction, { type: "SetViewingKey" }>;
  openChannels: Extract<ClientAction, { type: "OpenChannel" }>[];
  openTokenChannels: Extract<ClientAction, { type: "OpenSubchannel" }>[];
  deposits: Extract<ClientAction, { type: "Deposit" }>[];
  useNotes: Extract<ClientAction, { type: "UseNote" }>[];
  createNotes: (
    | Extract<ClientAction, { type: "CreateEncNote" }>
    | Extract<ClientAction, { type: "CreateOpenNote" }>
  )[];
  withdraws: Extract<ClientAction, { type: "Withdraw" }>[];
  invoke?: Extract<ClientAction, { type: "InvokeExternal" }>;
  computeAndInvoke?: Extract<ClientAction, { type: "ComputeAndInvoke" }>;
};

// Enforces that input has no extra properties beyond what's expected for its type
type StrictClientAction<T extends ClientAction> = T extends {
  type: infer Type extends ClientAction["type"];
  input: infer I;
}
  ? keyof I extends keyof Extract<ClientAction, { type: Type }>["input"]
    ? T
    : never
  : never;

function addOpenChannel(actions: Actions, recipient: StarknetAddressBigint) {
  actions.openChannels ??= [];
  // Check if recipient is already in openChannels to avoid duplicates
  const alreadyQueued = actions.openChannels.some((a) => a.recipient === recipient);
  if (!alreadyQueued) {
    actions.openChannels.push({
      recipient,
    });
  }
}

export class ActionCompiler {
  constructor(
    private userAddress: bigint,
    private userViewingKey: ViewingKey,
    private discoveryProvider: DiscoveryProviderInterface,
    private poolAddress: StarknetAddressBigint = 0n
  ) {}

  /**
   * Compile actions by resolving contexts, updating the registry, and producing ClientAction[].
   */
  async compile(actions: Actions, options?: ExecuteOptions): Promise<CompileResult> {
    try {
      return await this.compileOnce(actions, options);
    } catch (e) {
      if (e instanceof ReorgError) {
        debugLog("compiler", "compile", "reorg detected", e);
        // Reorg detected: clear stale registry state and retry from scratch.
        if (options?.registry) {
          options.registry.notes.clear();
          options.registry.channels.clear();
          delete options.registry.cursor;
        }
        return await this.compileOnce(actions, options);
      }
      throw e;
    }
  }

  private async compileOnce(actions: Actions, options?: ExecuteOptions): Promise<CompileResult> {
    const registry_ = options?.registry ?? createEmptyRegistry();
    const registry = options?.registryConst ? this.cloneRegistry(registry_) : registry_;
    const recipientsNeeded = this.getRecipientsNeeded(actions);

    // Resolve channels and notes concurrently (they are independent)
    const [{ channels, total }] = await Promise.all([
      this.resolveRecipientChannels(actions, options, registry, recipientsNeeded),
      this.resolveNotes(actions, registry, options),
    ]);

    debugLog("compiler", "compile", "post resolveNotes", registry?.notes?.size, actions);

    // create a pool to simulate the execution of the actions
    const pool = this.createPool(toBigInt(this.userViewingKey), registry, channels, total);

    // Phase 3: Transform Actions to ClientAction[]
    const clientActions = this.transformToClientActions(actions, pool, recipientsNeeded, options);

    debugLog("compiler", "compile", "post transformToClientActions", clientActions);

    return {
      clientActions,
      registry: pool.updateRegistry(registry),
      warnings: this.checkWarnings(clientActions),
    };
  }

  private checkWarnings(clientActions: ClientAction[]): Warning[] {
    const warnings: Warning[] = [];
    if (clientActions.filter((action) => action.type === "OpenChannel").length > 1) {
      warnings.push({
        code: WarningCode.USER_LINKAGE,
        message: "Multiple open channel actions found",
      });
    }
    return warnings;
  }

  private getRecipientsNeeded(actions: Actions): AddressMap<boolean> {
    // Collect ALL recipients that need a channel (from any action type)
    const recipientsNeeded = new AddressMap<boolean>([[this.userAddress, true]]);

    // If a channel is to be opened, need to discover the recipient's public key
    // to calculate the channel key for further actions.
    if (actions.openChannels) {
      for (const action of actions.openChannels) {
        recipientsNeeded.set(action.recipient, true);
      }
    }

    if (actions.openTokenChannels) {
      for (const action of actions.openTokenChannels) {
        recipientsNeeded.set(action.recipient, true);
      }
    }

    if (actions.createNotes) {
      for (const action of actions.createNotes) {
        recipientsNeeded.set(action.recipient, true);
      }
    }

    if (actions.surpluses) {
      for (const surplus of actions.surpluses) {
        recipientsNeeded.set(surplus.recipient, true);
      }
    }
    return recipientsNeeded;
  }

  private createPool(
    privateKey: bigint,
    registry?: PrivateRegistry,
    channels?: AddressMap<Channel>,
    totalChannels?: number
  ): PoolSimulator {
    const pool = new PoolSimulator(this.userAddress, privateKey, totalChannels ?? 0);

    debugLog("compiler", "setup discovered channels", channels);

    for (const [addr, channel] of channels?.entries() ?? []) {
      pool.setupChannel(addr, channel);
    }

    debugLog("compiler", "setup registry channels", registry?.channels);

    for (const [addr, channel] of registry?.channels?.entries() ?? []) {
      if (channels?.has(addr)) continue; // skip channels that were already set up in the previous step
      pool.setupChannel(addr, channel);
    }

    debugLog("compiler", "setup notes", registry?.notes);

    if (registry?.notes) {
      for (const [token, notes] of registry.notes.entries()) {
        for (const note of notes) {
          pool.setupNote(token, note);
        }
      }
    }

    return pool;
  }

  /**
   * Transform high-level Actions to low-level ClientAction[] using registry context.
   */
  private transformToClientActions(
    actions: Actions,
    pool: PoolSimulator,
    recipientsNeeded: AddressMap<boolean>,
    options?: ExecuteOptions
  ): ClientAction[] {
    const clientActions: ClientActions = {
      setViewingKey: undefined,
      openChannels: [],
      openTokenChannels: [],
      deposits: [],
      useNotes: [],
      createNotes: [],
      withdraws: [],
      invoke: undefined,
      computeAndInvoke: undefined,
    };

    debugLog("compiler", "transformToClientActions", actions);
    // if the user is registered, it must appear in the registry
    if (options?.autoRegister && !pool.getChannel(this.userAddress)?.publicKey) {
      actions.setViewingKey = {
        type: "SetViewingKey",
        input: { random: generateRandom() },
      };
    }

    if (actions.setViewingKey && options?.autoSetup) {
      // If registering, also open self-channel (it can't exist yet)
      addOpenChannel(actions, this.userAddress);
    }

    for (const recipient of recipientsNeeded.keys()) {
      const channel = pool.getChannel(recipient);
      if (!channel?.key && options?.autoSetup) {
        addOpenChannel(actions, recipient);
      } else {
        debugLog("compiler", "channel found", recipient, channel);
      }
    }

    const execute = <T extends A, A extends ClientAction = ClientAction>(
      input: StrictClientAction<T>,
      arr: A[] = []
    ): T => {
      pool.execute(input);
      arr.push(input);
      return input;
    };

    // 1. SetViewingKey
    if (actions.setViewingKey) {
      debugLog("compiler", "register", actions.setViewingKey);
      const input = {
        type: "SetViewingKey",
        input: {
          random: generateRandom(),
        },
      } as const; // typescipt magic
      clientActions.setViewingKey = execute(input);
    }

    // 2. OpenChannel (deduplicate by recipient to prevent duplicate channels)
    if (actions.openChannels) {
      const seenRecipients = new Set<bigint>();
      for (const action of actions.openChannels) {
        if (seenRecipients.has(action.recipient)) continue;
        seenRecipients.add(action.recipient);
        debugLog("compiler", "open channel x", action.recipient);
        const channel = pool.getChannel(action.recipient);
        assert(channel, () => `Missing channel context for recipient ${toHex(action.recipient)}`);
        const input = {
          type: "OpenChannel",
          input: {
            recipient_addr: action.recipient,
            index: pool.getNextChannelIndex(),
            random: generateRandom(),
            salt: generateRandom(),
          },
        } as const; // typescipt magic
        execute(input, clientActions.openChannels);
      }
    }

    const transformOpenSubchannel = (
      action: {
        recipient: bigint;
        token: bigint;
      },
      force: boolean
    ) => {
      const channel = pool.getChannel(action.recipient);
      assert(channel, () => `Channel not found for recipient ${toHex(action.recipient)}`);
      debugLog("compiler", "open channel", action.recipient, action, channel);

      if (channel.tokens.has(action.token)) {
        return channel;
      }

      if (!force && !options?.autoSetup) {
        return channel;
      }

      const input = {
        type: "OpenSubchannel",
        input: {
          recipient_addr: action.recipient,
          recipient_public_key: channel.publicKey as bigint,
          channel_key: channel.key as bigint,
          index: channel.tokens.size,
          token: action.token,
          salt: generateRandom(),
        },
      } as const; // typescipt magic
      execute(input, clientActions.openTokenChannels);

      return pool.getChannel(action.recipient)!; // on the safe side, the pool is not supposed to create a new Channel object
    };

    if (actions.openTokenChannels) {
      for (const action of actions.openTokenChannels) {
        transformOpenSubchannel(action, true);
      }
    }

    // 4. Deposit (token transfer + optional note creation)
    if (actions.deposits) {
      for (const action of actions.deposits) {
        // const noteId = action.noteId !== undefined ? toBigInt(action.noteId) : undefined;
        const input = {
          type: "Deposit",
          input: {
            token: action.token,
            amount: action.amount,
            //noteId,
          },
        } as const; // typescipt magic
        // if (noteId && !pool.hasNoteById(noteId)) {
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (pool as any).notes.set(noteId, {
        //     r: 1n,
        //     amount: 0n,
        //     token: action.token,
        //   });
        // }
        execute(input, clientActions.deposits);
      }
    }

    // 5. UseNote
    if (actions.useNotes) {
      for (const action of actions.useNotes) {
        const input = {
          type: "UseNote",
          input: {
            channel_key: action.note.witness.channelKey,
            token: action.token,
            index: action.note.witness.nonce,
          },
        } as const; // typescipt magic
        if (!pool.hasNote(action.token, toBigInt(action.note.id))) {
          // this means the note is not in the registry, trust the user knows it exists
          pool.setupNote(action.token, action.note); // add it to the registry
        }
        execute(input, clientActions.useNotes);
      }
    }

    // 6. CreateEncNote/CreateOpenNote
    if (actions.createNotes) {
      for (const action of actions.createNotes) {
        const channel = transformOpenSubchannel(
          {
            recipient: action.recipient,
            token: action.token,
          },
          false
        );

        if (isOpenNote(action)) {
          const input = {
            type: "CreateOpenNote",
            input: {
              recipient_addr: action.recipient,
              recipient_public_key: channel.publicKey as bigint,
              token: action.token,
              index: channel.tokens.get(action.token)!.noteNonce,
              random: generateRandom(),
            },
          } as const; // typescipt magic
          execute(input, clientActions.createNotes);
        } else {
          const input = {
            type: "CreateEncNote",
            input: {
              recipient_addr: action.recipient,
              recipient_public_key: channel.publicKey as bigint,
              token: action.token,
              amount: action.amount,
              index: channel.tokens.get(action.token)!.noteNonce,
              salt: generateRandom120(),
            },
          } as const; // typescipt magic
          execute(input, clientActions.createNotes);
        }
      }
    }

    // 7. Withdraw
    if (actions.withdraws) {
      for (const action of actions.withdraws) {
        const input = {
          type: "Withdraw",
          input: {
            to_addr: action.recipient,
            token: action.token,
            amount: action.amount,
            random: generateRandom(),
          },
        } as const; // typescipt magic
        execute(input, clientActions.withdraws);
      }
    }

    // surpluses were handled in resolveNotes

    // `invoke` and `computeAndInvoke` share the single invoke phase the pool allows per
    // transaction. The builder enforces this, but guard here too for hand-built `Actions`.
    assert(
      !(actions.invoke && actions.computeAndInvoke),
      () =>
        "At most one invoke-phase action (.invoke() / .computeAndInvoke()) per transaction; already set."
    );

    // 8. InvokeExternal
    if (actions.invoke) {
      const call = actions.invoke.callBuilder(this.invokeBuilderArgs(clientActions, pool));
      const calldata = CallData.compile(call.calldata ?? []).map(toBigInt);

      const input = {
        type: "InvokeExternal",
        input: {
          contract_address: toBigInt(call.contractAddress),
          calldata,
        },
      } as const; // typescipt magic
      clientActions.invoke = execute(input);
    }

    // 9. ComputeAndInvoke
    if (actions.computeAndInvoke) {
      const details = actions.computeAndInvoke.callBuilder(
        this.invokeBuilderArgs(clientActions, pool)
      );
      const compute_additional_data = CallData.compile(details.computeAdditionalData ?? []).map(
        toBigInt
      );
      const invoke_additional_data = CallData.compile(details.invokeAdditionalData ?? []).map(
        toBigInt
      );

      const input = {
        type: "ComputeAndInvoke",
        input: {
          contract_address: toBigInt(details.contractAddress),
          compute_additional_data,
          invoke_additional_data,
        },
      } as const;
      clientActions.computeAndInvoke = execute(input);
    }

    return Object.values(clientActions)
      .filter((action) => action !== undefined)
      .flat();
  }

  // Shared arguments for `invoke` / `computeAndInvoke` call builders: the open notes created
  // in this batch (so the callee can deposit into them) and the withdrawals it can consume.
  private invokeBuilderArgs(
    clientActions: ClientActions,
    pool: PoolSimulator
  ): InvokeCalldataBuilderArgs {
    const openNotes = clientActions.createNotes.flatMap((note) => {
      if (note.type !== "CreateOpenNote") return [];
      const channelKey = pool.getChannel(note.input.recipient_addr)?.key;
      assert(channelKey, () => `Missing channel key for open note recipient`);
      return [
        {
          noteId: compute_note_id(channelKey, note.input.token, note.input.index),
          token: note.input.token,
        },
      ];
    });
    const withdrawals = clientActions.withdraws.map((withdraw) => ({
      recipient: withdraw.input.to_addr,
      token: withdraw.input.token,
      amount: withdraw.input.amount,
    }));
    return { openNotes, withdrawals, poolAddress: this.poolAddress };
  }

  /**
   * Resolve recipient channels by discovering or using registry.
   */
  private async resolveRecipientChannels(
    actions: Actions,
    options: ExecuteOptions | undefined,
    registry: PrivateRegistry,
    recipientsNeeded: AddressMap<boolean>
  ): Promise<{ channels: AddressMap<Channel> | undefined; total?: number }> {
    const recipientDiscoveryLevel = options?.autoDiscover?.channels;

    if (!recipientDiscoveryLevel) {
      // Allow discovery for OpenChannel actions as they require fetching the recipient's public key
      const hasOpenChannels = actions.openChannels && actions.openChannels.length > 0;
      if (!hasOpenChannels && !options?.autoSetup) {
        return { channels: undefined, total: undefined };
      }
    }

    // Determine which recipients to discover based on discovery level
    let recipientsToDiscover: StarknetAddressBigint[];

    if (recipientDiscoveryLevel === "refresh") {
      // Refresh: discover ALL recipients to get latest nonces
      recipientsToDiscover = [...recipientsNeeded.keys()];
    } else {
      // None or 'missing': only discover recipients not in registry
      recipientsToDiscover = [...recipientsNeeded.keys()].filter((r) => !registry.channels.has(r));
    }

    if (recipientsToDiscover.length === 0) {
      return { channels: undefined, total: undefined };
    }

    // Discover channels for all recipients that need discovery in a single call
    // discoverChannels computes channel keys and returns current nonce state
    const { channels, total } = await this.discoveryProvider.discoverChannels(
      this.userAddress,
      this.userViewingKey,
      recipientsToDiscover,
      { blockIdentifier: options?.provingBlockId }
    );

    // see if all recipients were discoveredall
    if (this.allOpen(channels, recipientsToDiscover)) {
      return { channels, total: undefined };
    }

    // Opening a new channel needs the sender's outgoing-channel count. The
    // discovery above already walked to the sentinel for the indexer provider,
    // so reuse its count; only providers whose targeted discovery stops short of
    // the sentinel (e.g. on-chain ContractDiscovery) fall back to a count query.
    const resolvedTotal =
      total ??
      (
        await this.discoveryProvider.discoverChannels(
          this.userAddress,
          this.userViewingKey,
          "total-only",
          { blockIdentifier: options?.provingBlockId }
        )
      ).total;

    return { channels, total: resolvedTotal };
  }

  /**
   * Resolve notes by discovering and/or auto-selecting from registry.
   */
  private async resolveNotes(
    actions: Actions,
    registry: PrivateRegistry,
    options?: ExecuteOptions
  ): Promise<void> {
    if (!actions.surpluses && !options?.autoSelectNotes) return;

    // Calculate token balances (inputs - outputs)
    // Positive balance = surplus (needs change note)
    // Negative balance = deficit (needs input notes)
    const balances = new AddressMap(() => 0n);

    const update = (token: bigint, amount: Amount) => {
      const current = balances.get(token)!;
      balances.set(token, current + amount);
    };

    // Inputs: Deposits (without noteId)
    if (actions.deposits) {
      for (const d of actions.deposits) {
        assert(d.amount > 0n, () => `Deposit amount must be positive`);
        if (d.noteId === undefined) {
          // a deposit to an open note immediately cancels the balance
          update(d.token, d.amount);
        }
      }
    }

    // Inputs: Existing UseNotes
    const usedNoteIds = new AdvancedMap<BigNumberish, boolean, string>({
      keyConverter: (key: BigNumberish) => String(key),
    });

    if (actions.useNotes) {
      for (const u of actions.useNotes) {
        assert(u.note.amount > 0n, () => `Note ${u.note.id}: amount must be positive`);
        update(u.token, u.note.amount);
        usedNoteIds.set(u.note.id, true);
      }
    }

    // Outputs: Withdraws
    if (actions.withdraws) {
      for (const w of actions.withdraws) {
        assert(w.amount > 0n, () => `Withdraw amount must be positive`);
        update(w.token, -w.amount);
      }
    }

    // Outputs: CreateNotes (ignore Open amounts)
    if (actions.createNotes) {
      for (const c of actions.createNotes) {
        assert(
          isOpen(c.amount) || c.amount > 0n,
          () => `Created note amount must be positive (token: ${toHex(c.token)})`
        );
        if (!isOpen(c.amount)) {
          update(c.token, -c.amount);
        }
      }
    }

    const notesDiscoveryLevel = options?.autoDiscover?.notes;
    // discover notes if requested
    if (notesDiscoveryLevel !== undefined) {
      const tokensToDiscover = (() => {
        if (notesDiscoveryLevel === "all") return undefined;
        return [...balances.entries()]
          .filter(([token, balance]) => {
            // Case 1: We have a deficit (negative balance), so we need inputs.
            const hasDeficit = balance < 0n;

            // Case 2: We want to sweep all funds (autoSelectNotes="all") into a surplus recipient.
            // Even if balance is 0, we check if we should fetch notes to dump them.
            const isSweeping =
              options?.autoSelectNotes === "all" && // assume 'all' means the user wants to always "compress" their notes even if balance is 0
              actions.surpluses?.some((s) => s.token === token);

            if (!hasDeficit && !isSweeping) return false;

            // Finally, check if discovery is actually needed (forced refresh or missing from registry)
            return notesDiscoveryLevel === "refresh" || !registry.notes.has(token);
          })
          .map(([token]) => token);
      })();

      debugLog("compiler", "discovering notes", tokensToDiscover);

      if (!tokensToDiscover || tokensToDiscover.length > 0) {
        const { notes, cursor } = await this.discoveryProvider.discoverNotes(
          this.userAddress,
          this.userViewingKey,
          {
            cursor: registry.cursor,
            tokens: tokensToDiscover,
            blockIdentifier: options?.provingBlockId,
          }
        );

        // Replace registry notes (don't merge - some may have been spent)
        for (const [token, discoveredNotes] of notes.entries()) {
          registry.notes.set(token, discoveredNotes);
        }
        registry.cursor = cursor;
      }
    }

    // Resolve deficits and surpluses
    for (const token of balances.keys()) {
      let balance = balances.get(token)!;

      // If deficit, try to cover with notes from registry
      if ((balance < 0n && options?.autoSelectNotes) || options?.autoSelectNotes === "all") {
        const availableNotes = registry.notes.get(token) ?? [];
        actions.useNotes ??= [];

        // naively select unused notes from registry (may create surplus)
        // sort by amount in descending order to select the largest notes first to avoid an attack of sending
        // dust notes to the user
        // TODO: Implement an 'exact' strategy that selects notes exactly to cover the deficit
        for (const note of availableNotes.slice().sort((a, b) => Number(b.amount - a.amount))) {
          if (usedNoteIds.has(note.id)) continue; // Skip used notes

          actions.useNotes.push({ token, note });
          balance += note.amount;
          if (balance >= 0n && options?.autoSelectNotes !== "all") break; // Deficit covered
        }
      }

      // Guard against insufficient balance: if still in deficit after auto-selection,
      // the prover would fail with NEGATIVE_INTERMEDIATE_BALANCE. Fail fast here instead.
      if (balance < 0n) {
        const totalAvailable = (registry.notes.get(token) ?? []).reduce(
          (sum, note) => sum + note.amount,
          0n
        );
        throw new Error(
          `Insufficient balance for token ${toHex(token)}: ` +
            `need ${-balance} more (total available: ${totalAvailable})`
        );
      }

      // If surplus (after adding notes or initially), create change note
      if (balance > 0n) {
        let surplusAction = actions.surpluses?.find((s) => s.token === token);
        if (!surplusAction) {
          if (actions.deposits?.some((d) => d.token === token)) {
            surplusAction = {
              recipient: this.userAddress,
              token,
              withdraw: false,
            };
            actions.surpluses ??= [];
            actions.surpluses.push(surplusAction);
          } else {
            throw new Error(
              `Surplus of ${balance} found for token ${toHex(token)} but no surplus action found`
            );
          }
        }
        if (surplusAction.withdraw) {
          actions.withdraws ??= [];
          actions.withdraws.push({
            recipient: surplusAction.recipient,
            token,
            amount: balance,
          });
        } else {
          actions.createNotes ??= [];
          actions.createNotes.push({
            recipient: surplusAction.recipient,
            token,
            amount: balance,
          });
        }
      }
    }
  }

  private cloneRegistry(registry: PrivateRegistry): PrivateRegistry {
    // Clone channels
    const clonedChannels = new AddressMap<Channel>();
    for (const [addr, channel] of registry.channels.entries()) {
      clonedChannels.set(addr, channel);
    }

    // Clone notes
    const clonedNotes = new AddressMap<Note[]>(() => []);
    for (const [addr, notes] of registry.notes.entries()) {
      clonedNotes.set(addr, [...notes]);
    }

    return { channels: clonedChannels, notes: clonedNotes };
  }

  private allOpen(
    channels: AddressMap<Channel> | undefined,
    recipients: StarknetAddressBigint[]
  ): boolean {
    return recipients.every((recipient) => channels?.get(recipient)?.key !== undefined);
  }
}
