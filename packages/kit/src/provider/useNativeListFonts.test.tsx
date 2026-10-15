/** @jest-environment jsdom */

jest.mock('@onekeyfe/react-native-native-list', () => ({
  configureNativeListFonts: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));

describe('NativeList browser font bootstrap', () => {
  it.each(['loaded', 'missing', 'rejected', 'timeout'] as const)(
    'waits for all four weights and handles %s faces',
    async (outcome) => {
      let finish!: (value: FontFace[]) => void;
      let fail!: (error: Error) => void;
      const loading = new Promise<FontFace[]>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      const load = jest.fn<Promise<FontFace[]>, [string]>(() => loading);
      if (outcome === 'timeout') jest.useFakeTimers();
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { load },
      });
      let unmount!: () => void;
      let current!: { current: boolean };
      let act!: (typeof import('@testing-library/react'))['act'];
      let configure!: jest.Mock;
      jest.isolateModules(() => {
        const testing =
          require('@testing-library/react/pure') as typeof import('@testing-library/react/pure');
        const { useNativeListFonts } =
          require('./useNativeListFonts') as typeof import('./useNativeListFonts');
        configure = (
          require('@onekeyfe/react-native-native-list') as {
            configureNativeListFonts: jest.Mock;
          }
        ).configureNativeListFonts;
        const rendered = testing.renderHook(() => useNativeListFonts());
        current = rendered.result;
        unmount = rendered.unmount;
        act = testing.act;
      });
      expect(current.current).toBe(false);
      expect(load.mock.calls.map((call) => call[0])).toEqual(
        [400, 500, 600, 700].map((weight) => `${weight} 16px "Roobert"`),
      );
      expect(configure).not.toHaveBeenCalled();
      await act(async () => {
        if (outcome === 'timeout') jest.advanceTimersByTime(3000);
        else if (outcome === 'rejected')
          fail(new Error('font network failure'));
        else finish(outcome === 'loaded' ? [{} as FontFace] : []);
      });
      expect(current.current).toBe(true);
      if (outcome === 'loaded')
        expect(configure).toHaveBeenCalledWith({
          regular: 'Roobert',
          medium: 'Roobert',
          semibold: 'Roobert',
          bold: 'Roobert',
        });
      else expect(configure).not.toHaveBeenCalled();
      unmount();
      jest.useRealTimers();
    },
  );
});
