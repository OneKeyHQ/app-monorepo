// Core toast feedback with error handling
export { withToast } from './withToast';
export type { IWithToastOptions } from './withToast';

// Types and configurations
export { EActionType, EErrorType } from './types';
export type { IToastConfig } from './types';
export { TOAST_CONFIGS, ERROR_PATTERNS, ERROR_MESSAGES } from './config';

// Legacy toast feedback (for backward compatibility)
export { withToastFeedback } from './toastFeedback';
export type { IToastFeedbackConfig } from './toastFeedback';
