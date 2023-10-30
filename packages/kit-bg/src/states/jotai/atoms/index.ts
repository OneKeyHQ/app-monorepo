import * as demo from './demo';

const allAtoms = {
  ...demo,
};

console.log(Object.keys(allAtoms));
if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$allAtoms = allAtoms;
}

export default allAtoms;
