import { EAtomNames } from '../atomNames';
import {
  globalAtom,
  globalAtomComputedR,
  globalAtomComputedRW,
  globalAtomComputedW,
} from '../utils';

export const { target: demoPriceAtom, use: useDemoPriceAtom } = globalAtom({
  initialValue: 10,
  name: EAtomNames.demoPriceAtom,
  persist: true,
});

export const {
  target: demoPriceNotPersistAtom,
  use: useDemoPriceNotPersistAtom,
} = globalAtom({
  initialValue: 3,
  name: EAtomNames.demoPriceNotPersistAtom,
});

// export const { target: demoPriceAtom, use: useDemoPriceAtom } = makeCrossAtom(
//   'demoPriceAtom',
//   () =>
//     crossAtomBuilder({
//       name: 'demoPriceAtom',
//       initialValue: 10,
//       storageName: 'demoPriceAtom',
//     }),
// );

// computed atoms (R)
export const { target: demoReadOnlyAtom, use: useDemoReadOnlyAtom } =
  globalAtomComputedR({
    read: (get) => {
      const a = demoPriceAtom.atom();
      return get(a) * 2;
    },
  });

// (W)
export const { target: demoWriteOnlyAtom, use: useDemoWriteOnlyAtom } =
  globalAtomComputedW<null, [{ discount: number }], void>({
    // read: () => null,
    write: async (get, set, update) => {
      const v1 = get(demoPriceAtom.atom());
      const v = await demoPriceAtom.get();
      // `update` is any single value we receive for updating this atom
      await demoPriceAtom.set(v - update.discount);
    },
  });

// export const { target: demoWriteOnlyAtom, use: useDemoWriteOnlyAtom } =
//   makeCrossAtom('demoWriteOnlyAtom', () =>
//     crossAtomBuilder<null, [{ discount: number }], void>({
//       name: 'demoWriteOnlyAtom',
//       initialValue: null,
//       write: async (get, set, update) => {
//         const v1 = get(demoPriceAtom.atom());
//         const v = await demoPriceAtom.get();
//         // `update` is any single value we receive for updating this atom
//         await demoPriceAtom.set(v - update.discount);
//       },
//     }),
//   );

// computed atoms with setter (RW)
export const { target: demoReadWriteAtom, use: useDemoReadWriteAtom } =
  globalAtomComputedRW<string, [number], void>({
    read: (get) => (get(demoPriceAtom.atom()) * 0.5).toString(), // NOT working for reactive update, use get() instead
    write: async (get, set, newPrice) => {
      set(demoPriceAtom.atom(), newPrice / 2);
      // await demoPriceAtom.set(newPrice / 2);
      // you can set as many atoms as you want at the same time
    },
  });

// export const { target: demoReadWriteAtom, use: useDemoReadWriteAtom } =
//   makeCrossAtom('demoReadWriteAtom', () =>
//     crossAtomBuilder<string, [number], void>({
//       name: 'demoReadWriteAtom',
//       read: (get) => (get(demoPriceAtom.atom()) * 0.5).toString(), // NOT working for reactive update, use get() instead
//       write: async (get, set, newPrice) => {
//         set(demoPriceAtom.atom(), newPrice / 2);
//         // await demoPriceAtom.set(newPrice / 2);
//         // you can set as many atoms as you want at the same time
//       },
//     }),
//   );
