import {
  SimplePrivateTransfersInterface,
  PrivateTransfersInterface,
  Amount,
  Channel,
  Note,
  Open,
  PrivateRegistry,
  StarknetAddress,
  All,
  ExecuteResult,
} from "./interfaces"; // Assuming you moved interfaces
import { toBigInt } from "./utils/convert";
import { toHex } from "./utils/convert";
import { AddressMap } from "./utils/maps";
import { isAll } from "./utils/validation";

export class SimplePrivateTransfersImpl implements SimplePrivateTransfersInterface {
  constructor(private inner: PrivateTransfersInterface) {}

  get user(): StarknetAddress {
    return this.inner.user;
  }

  readonly registry: PrivateRegistry = {
    channels: new AddressMap<Channel>(),
    notes: new AddressMap<Note[]>(),
  };

  deposit(token: StarknetAddress, amount: Amount): Promise<ExecuteResult> {
    return this.build(token).deposit({ amount }).execute();
  }

  withdraw(
    token: StarknetAddress,
    recipient: StarknetAddress,
    amount: Amount | All
  ): Promise<ExecuteResult> {
    const builder = this.build(token);
    if (isAll(amount)) {
      // Withdraw all: send everything as surplus to recipient's public balance
      // TODO(Avi): no-op today — resolveNotes only enters a token into `balances` via
      // deposits/useNotes/withdraws/createNotes, so a bare surplusTo with no other action
      // on the token never selects notes or emits a withdraw. Needs a fix in internal/compiler.ts.
      return builder.surplusTo(recipient, true).execute();
    }
    // Withdraw specific amount: pay recipient publicly, keep surplus as a private note
    return builder.withdraw({ recipient, amount }).surplusTo(this.inner.user, false).execute();
  }

  transfer(
    token: StarknetAddress,
    recipient: StarknetAddress,
    amount: Amount | All
  ): Promise<ExecuteResult> {
    const builder = this.build(token);
    if (isAll(amount)) {
      // Transfer all: send everything as surplus to recipient
      return builder.surplusTo(recipient, false).execute();
    }
    // Transfer specific amount: send amount to recipient, keep surplus
    return builder.transfer({ recipient, amount }).surplusTo(this.inner.user, false).execute();
  }

  swap(
    fromToken: StarknetAddress,
    fromAmount: Amount,
    toToken: StarknetAddress,
    executor: StarknetAddress
  ): Promise<ExecuteResult> {
    const toTokenAddress = toBigInt(toToken);
    return this.build(fromToken)
      .withdraw({ recipient: executor, amount: fromAmount })
      .surplusTo(this.inner.user, false) // Keep ACE surplus as private note
      .with(toToken)
      .transfer({ recipient: this.inner.user, amount: Open })
      .done()
      .invoke(({ openNotes, withdrawals }) => {
        return {
          contractAddress: toHex(executor),
          calldata: [
            withdrawals[0].token,
            toTokenAddress,
            withdrawals[0].amount,
            openNotes[0].noteId,
          ],
        };
      })
      .execute();
  }

  private build(token: StarknetAddress) {
    // Clear notes before refresh to avoid stale entries (already-spent notes)
    this.registry.notes.clear();
    return this.inner
      .build({
        autoDiscover: { notes: "refresh", channels: "refresh" },
        autoSetup: true,
        autoSelectNotes: "all",
        registry: this.registry,
      })
      .with(token);
  }
}
