import semver from 'semver';

export async function processMigration({
  dbMigrationVersion,
  checkVersion,
  doMigration,
}: {
  dbMigrationVersion: string | undefined;
  checkVersion: string;
  doMigration: () => Promise<void>;
}) {
  if (
    dbMigrationVersion &&
    semver.valid(dbMigrationVersion) &&
    semver.gte(dbMigrationVersion, checkVersion)
  ) {
    return {
      skip: true,
    };
  }
  await doMigration();

  return {
    skip: false,
  };
}
