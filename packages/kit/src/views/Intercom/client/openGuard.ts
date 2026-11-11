export type IShowIntercomParams = {
  requestId?: string;
  conversationId?: string;
};

export function createIntercomOpenGuard(onError: (error: unknown) => void) {
  type IOpen = { pending?: Promise<void>; cooldownUntil: number };
  let state:
    | {
        userId: string | null;
        conversationRevision: number;
        opens: Map<string, IOpen>;
      }
    | undefined;
  const setIdentity = (userId: string | null) => {
    if (!state || state.userId !== userId) {
      state = { userId, conversationRevision: 0, opens: new Map() };
    }
    return state;
  };

  return {
    setIdentity,
    reset() {
      state = undefined;
    },
    run(
      userId: string | null,
      params: IShowIntercomParams | undefined,
      open: (canPresent: () => boolean) => Promise<boolean>,
    ): Promise<void> {
      const current = setIdentity(userId);
      const now = performance.now();
      for (const [key, entry] of current.opens) {
        if (!entry.pending && entry.cooldownUntil <= now) {
          current.opens.delete(key);
        }
      }
      const targeted = !!params?.conversationId;
      const key = params?.requestId ?? '';
      if (targeted) {
        // A late ordinary open must not replace a notification's conversation.
        current.conversationRevision += 1;
        current.opens.clear();
      } else {
        const previous = current.opens.get(key);
        if (previous?.pending) {
          return previous.pending;
        }
        if (previous && previous.cooldownUntil > now) {
          return Promise.resolve();
        }
      }
      const revision = current.conversationRevision;
      const entry: IOpen = { cooldownUntil: 0 };
      const operation = Promise.resolve()
        .then(() =>
          open(
            () =>
              state === current && current.conversationRevision === revision,
          ),
        )
        .then((opened) => {
          if (!targeted && current.opens.get(key) === entry) {
            if (opened) {
              // Android resolves present before the presentation animation ends.
              entry.cooldownUntil = performance.now() + 1000;
            } else {
              current.opens.delete(key);
            }
          }
        })
        .catch((error: unknown) => {
          if (current.opens.get(key) === entry) {
            current.opens.delete(key);
          }
          onError(error);
        })
        .finally(() => {
          if (current.opens.get(key) === entry) {
            entry.pending = undefined;
          }
        });
      if (!targeted) {
        entry.pending = operation;
        current.opens.set(key, entry);
      }
      return operation;
    },
  };
}
