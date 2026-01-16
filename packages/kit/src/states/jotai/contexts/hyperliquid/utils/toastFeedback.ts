import { Toast } from '@onekeyhq/components';

// Legacy toast feedback (for backward compatibility)

export interface IToastFeedbackConfig {
  loadingTitle: string;
  successTitle: string;
  successMessage?: string;
  delay?: number;
  showLoading?: boolean;
}

// Toast feedback utility for async operations
export const withToastFeedback = async <T>(
  asyncFn: () => Promise<T>,
  config: IToastFeedbackConfig,
): Promise<T> => {
  const { showLoading = true, delay = 300 } = config;
  let loadingToast: { close: () => void } | undefined;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;

  // Only show loading toast if showLoading is true
  if (showLoading) {
    loadingTimer = setTimeout(() => {
      loadingToast = Toast.loading({
        title: config.loadingTitle,
        duration: Infinity,
      });
    }, delay);
  }

  try {
    const result = await asyncFn();

    // Clean up loading
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingToast?.close();

    // Show success toast
    Toast.success({
      title: config.successTitle,
      message: config.successMessage,
    });

    return result;
  } catch (error) {
    // Clean up loading toast
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingToast?.close();

    // Simple error handling for legacy compatibility
    const errorMessage = error instanceof Error ? error.message : String(error);
    Toast.error({
      title: 'Operation Failed',
      message: errorMessage,
    });

    // Re-throw error for service layer handling
    throw error;
  }
};
