export type IEarnTaskScope = Readonly<{
  accountId: string;
  networkId: string;
  provider: string;
  /** An unresolved address must be bound and rechecked before signing or sending. */
  accountAddress?: string;
  indexedAccountId?: string;
}>;

export type IEarnTaskIdentity<
  TAction extends string,
  TIntent,
> = IEarnTaskScope &
  Readonly<{
    action: TAction;
    intent: TIntent;
  }>;

export type IEarnTaskStepKind =
  | 'wrap'
  | 'swap'
  | 'resetApproval'
  | 'approve'
  | 'deposit'
  | 'protocol'
  | 'sign'
  | 'external'
  | 'wait';

export type IEarnTaskStep<
  TKind extends string = IEarnTaskStepKind,
  TStatus = unknown,
> = {
  id: string;
  kind: TKind;
  attemptId?: string;
  status: TStatus;
};

/** The provider owns its identity and immutable intent snapshot. */
export type IEarnTask<
  TIdentity extends IEarnTaskScope,
  TStep extends IEarnTaskStep<string>,
> = {
  taskId: string;
  identity: TIdentity;
  steps: TStep[];
  currentStepIndex: number;
};

export type IEarnTaskStepIdentityError = 'empty' | 'duplicate';

/** Preserve IDs exactly; action-specific constraints belong to the caller. */
export function getEarnTaskStepIdentityError(
  steps: readonly { id: string }[],
): IEarnTaskStepIdentityError | undefined {
  if (!steps.length || steps.some((step) => !step.id)) return 'empty';
  if (new Set(steps.map((step) => step.id)).size !== steps.length) {
    return 'duplicate';
  }
  return undefined;
}
