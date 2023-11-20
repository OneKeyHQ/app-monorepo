import localDb from './localDbInstance';

if (process.env.NODE_ENV !== 'production') {
  global.$$localDb = localDb;
}
export default localDb;
