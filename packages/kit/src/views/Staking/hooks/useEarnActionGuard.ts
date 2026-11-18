import { useLayoutEffect, useRef, useState } from 'react';

export type IEarnFooterAction = {
  text: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export type IEarnActionGuardVerificationOptions = {
  allowRevoke?: boolean;
};

export type IEarnActionGuard = {
  action?: IEarnFooterAction;
  loading: boolean;
  blocked: boolean;
  verifyBeforeAction: (
    options?: IEarnActionGuardVerificationOptions,
  ) => Promise<boolean>;
  isActionAllowed?: () => boolean;
};

export function useEarnActionGuard({
  action,
  override,
  guard,
  identity,
}: {
  action: IEarnFooterAction;
  override?: IEarnFooterAction;
  guard?: IEarnActionGuard;
  identity: string;
}): IEarnFooterAction {
  const [scope, setScope] = useState(() => ({ identity }));
  if (scope.identity !== identity) setScope({ identity });
  const committedRef = useRef({ scope, action, override, guard });
  useLayoutEffect(() => {
    committedRef.current = { scope, action, override, guard };
  }, [scope, action, override, guard]);
  const lifetimeRef = useRef<object | undefined>(undefined);
  useLayoutEffect(() => {
    const lifetime = {};
    lifetimeRef.current = lifetime;
    return () => {
      if (lifetimeRef.current === lifetime) lifetimeRef.current = undefined;
    };
  }, []);

  if (override) return override;
  if (guard?.action) return guard.action;
  if (!guard) return action;

  return {
    text: action.text,
    loading: Boolean(action.loading || guard.loading),
    disabled: Boolean(action.disabled || guard.blocked),
    onPress: () => {
      const lifetime = lifetimeRef.current;
      if (!lifetime || committedRef.current.scope !== scope) return;
      void (async () => {
        const verified = await guard.verifyBeforeAction();
        const current = committedRef.current;
        if (
          verified &&
          lifetimeRef.current === lifetime &&
          current.scope === scope &&
          current.action.onPress === action.onPress &&
          !current.action.disabled &&
          !current.override &&
          !current.guard?.action &&
          (current.guard?.isActionAllowed?.() ?? !current.guard?.blocked) &&
          current.guard?.verifyBeforeAction === guard.verifyBeforeAction
        ) {
          action.onPress();
        }
      })();
    },
  };
}
