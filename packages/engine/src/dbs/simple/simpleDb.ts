import { SimpleDbEntityHistory } from './entity/SimpleDbEntityHistory';

class SimpleDb {
  history = new SimpleDbEntityHistory();
}

const simpleDb = new SimpleDb();
if (process.env.NODE_ENV !== 'production') {
  global.$simpleDb = simpleDb;
}
export default simpleDb;
