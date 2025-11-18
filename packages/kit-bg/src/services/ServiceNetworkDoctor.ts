import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IDiagnosticProgress } from '@onekeyhq/shared/src/modules/NetworkDoctor/types';

import { networkDoctorStateAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNetworkDoctor extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Progress smoother state
  private progressSmoother: {
    targetProgress: number;
    currentProgress: number;
    intervalId?: ReturnType<typeof setInterval>;
    latestProgressData?: IDiagnosticProgress;
  } = {
    targetProgress: 0,
    currentProgress: 0,
  };

  /**
   * Smoothly interpolate progress from current to target
   */
  private startProgressSmoother(): void {
    // Clear existing interval
    if (this.progressSmoother.intervalId) {
      clearInterval(this.progressSmoother.intervalId);
    }

    // Update progress every 50ms for smooth animation
    this.progressSmoother.intervalId = setInterval(() => {
      const { currentProgress, targetProgress, latestProgressData } =
        this.progressSmoother;

      if (!latestProgressData) return;

      // Linear interpolation step (increment by 2% each tick for smooth transition)
      const step = 2;

      if (currentProgress < targetProgress) {
        const nextProgress = Math.min(currentProgress + step, targetProgress);
        this.progressSmoother.currentProgress = nextProgress;

        // Update atom with interpolated progress
        void networkDoctorStateAtom.set({
          status: 'running',
          progress: {
            ...latestProgressData,
            percentage: nextProgress,
          },
          result: null,
          error: null,
        });
      }
    }, 50); // 50ms = 20fps, smooth enough for progress bar
  }

  /**
   * Stop progress smoother
   */
  private stopProgressSmoother(): void {
    if (this.progressSmoother.intervalId) {
      clearInterval(this.progressSmoother.intervalId);
      this.progressSmoother.intervalId = undefined;
    }
    this.progressSmoother.currentProgress = 0;
    this.progressSmoother.targetProgress = 0;
    this.progressSmoother.latestProgressData = undefined;
  }

  /**
   * Run network diagnostics with singleton pattern
   * Returns true if diagnostics started, false if already running
   */
  @backgroundMethod()
  async runNetworkDiagnostics(): Promise<boolean> {
    const { NetworkDoctor } = await import(
      '@onekeyhq/shared/src/modules/NetworkDoctor'
    );

    const currentState = await networkDoctorStateAtom.get();

    // Singleton check: only allow one instance to run at a time
    if (currentState.status === 'running') {
      return false;
    }

    // Reset state and start running
    await networkDoctorStateAtom.set({
      status: 'running',
      progress: null,
      result: null,
      error: null,
    });

    // Start progress smoother
    this.startProgressSmoother();

    try {
      // Create new NetworkDoctor instance with progress callback
      const doctor = new NetworkDoctor({
        onProgress: (progress) => {
          // Update target progress for smoother
          this.progressSmoother.targetProgress = progress.percentage;
          this.progressSmoother.latestProgressData = progress;
        },
      });

      // Run diagnostics
      const result = await doctor.run();

      // Stop progress smoother
      this.stopProgressSmoother();

      // Update state with result
      await networkDoctorStateAtom.set({
        status: 'completed',
        progress: null,
        result,
        error: null,
      });

      return true;
    } catch (error) {
      // Stop progress smoother on error
      this.stopProgressSmoother();

      // Update state with error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await networkDoctorStateAtom.set({
        status: 'failed',
        progress: null,
        result: null,
        error: errorMessage,
      });

      return true;
    }
  }

  /**
   * Reset network doctor state to idle
   */
  @backgroundMethod()
  async resetNetworkDiagnostics(): Promise<void> {
    // Stop progress smoother
    this.stopProgressSmoother();

    await networkDoctorStateAtom.set({
      status: 'idle',
      progress: null,
      result: null,
      error: null,
    });
  }

  /**
   * Check if network diagnostics are currently running
   */
  @backgroundMethod()
  async isNetworkDiagnosticsRunning(): Promise<boolean> {
    const state = await networkDoctorStateAtom.get();
    return state.status === 'running';
  }
}

export default ServiceNetworkDoctor;
