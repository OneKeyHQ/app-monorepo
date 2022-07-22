import { SimpleDbEntityHistory } from './entity/SimpleDbEntityHistory';
import { SimpleDbEntityLastActivity } from './entity/SimpleDbEntityLastActivity';
import { SimpleDbEntityPwKey } from './entity/SimpleDbEntityPwKey';

class SimpleDb {
  history = new SimpleDbEntityHistory();

  pwkey = new SimpleDbEntityPwKey();

  lastActivity = new SimpleDbEntityLastActivity();
}

const simpleDb = new SimpleDb();
if (process.env.NODE_ENV !== 'production') {
  global.$simpleDb = simpleDb;
}
export default simpleDb;
