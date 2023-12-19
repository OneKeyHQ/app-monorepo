import { useEffect } from 'react';

export class AppStateSignal {
  static instance: AppStateSignal = new AppStateSignal();

  private state: 'on' | 'off' = 'on';

  pause() {
    this.state = 'off';
  }

  resume() {
    this.state = 'on';
  }

  isOff() {
    return this.state === 'off';
  }
}

export const OffAppState = () => {
  useEffect(() => {
    AppStateSignal.instance.pause();
    return () => {
      AppStateSignal.instance.resume();
    };
  }, []);
};
