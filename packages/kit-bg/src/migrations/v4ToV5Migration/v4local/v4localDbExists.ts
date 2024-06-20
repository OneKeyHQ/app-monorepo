import { V4_INDEXED_DB_NAME } from './v4localDBConsts';

export default async function v4localDbExists(): Promise<boolean> {
  try {
    const databases = await window.indexedDB.databases();
    return databases.some((db) => db.name === V4_INDEXED_DB_NAME);
  } catch (error) {
    return false;
  }
}
