export type IOneKeyIdAuthFailureLogLimiterStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

// Native runtimes and the CLI have no web storage: the limiter keeps its
// state in memory for the life of the runtime.
export function getOneKeyIdAuthFailureLogLimiterStorage():
  | IOneKeyIdAuthFailureLogLimiterStorage
  | undefined {
  return undefined;
}
