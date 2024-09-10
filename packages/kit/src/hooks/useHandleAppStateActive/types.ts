export type IUseHandleAppStateActive = (
  onHandler?: () => void | undefined, // onActiveFromBackground
  handlers?: {
    onActiveFromBlur?: () => void;
  },
) => void;
