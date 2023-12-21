export interface INativePromiseRejectionTracker {
  getUnhandledPromiseRejectionTracker: () =>
    | ((id: string, error: Error) => void)
    | undefined;
  setErrorTracker: (tracker: (error: Error) => void) => void;
}
