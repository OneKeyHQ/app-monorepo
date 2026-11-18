import { isZcashRuntimeDatabaseBroken } from './vaultUtils';

describe.each(['flat', 'payload'])(
  'isZcashRuntimeDatabaseBroken (%s)',
  (shape) => {
    function runtimeError(
      code: string,
      params: Record<string, unknown>,
      detail?: string,
    ) {
      const fields = { code, params, detail };
      return Object.assign(
        new Error(code),
        shape === 'payload' ? { payload: fields } : fields,
      );
    }

    it.each([
      undefined,
      'migration failed: invalid schema',
      'Wallet database is corrupted: Network type mismatch: account UFVK is for mainnet but attempting to initialize for testnet.',
      'Wallet database is corrupted: invalid account metadata',
    ])(
      'preserves the database after an unrecognized migration failure: %s',
      (detail) => {
        expect(
          isZcashRuntimeDatabaseBroken(
            runtimeError('DATABASE_ERROR', { operation: 'migrate' }, detail),
          ),
        ).toBe(false);
      },
    );

    it.each([
      'database disk image is malformed',
      'SQLITE_CORRUPT',
      'SQLITE_CORRUPT_INDEX',
      'SQLITE_NOTADB',
      'file is not a database',
    ])(
      'recognizes physical SQLite corruption during migration: %s',
      (detail) => {
        expect(
          isZcashRuntimeDatabaseBroken(
            runtimeError('DATABASE_ERROR', { operation: 'migrate' }, detail),
          ),
        ).toBe(true);
      },
    );

    it.each([
      'database disk image is malformed',
      'database is corrupt',
      'file is not a database',
      'invalid disk image',
    ])('rebuilds a genuinely corrupt database: %s', (detail) => {
      expect(
        isZcashRuntimeDatabaseBroken(
          runtimeError('DATABASE_ERROR', { operation: 'syncStep' }, detail),
        ),
      ).toBe(true);
      expect(
        isZcashRuntimeDatabaseBroken(
          runtimeError(
            'DATABASE_ERROR',
            { operation: 'importAccount' },
            detail,
          ),
        ),
      ).toBe(false);
    });

    it.each([
      'database is locked',
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'disk I/O error',
      'SQLITE_IOERR_READ',
      'input/output error',
      'no space left on device',
      'out of disk space',
      'database or disk is full',
      'SQLITE_FULL',
      'storage quota exceeded',
      'DATABASE_TOO_NEW',
      'database was created by a newer version',
      'unknown migrations',
      'Wallet database is corrupted: database is locked',
      'Wallet database is corrupted: storage quota exceeded',
    ])(
      'never rebuilds for a transient or incompatible migration: %s',
      (detail) => {
        expect(
          isZcashRuntimeDatabaseBroken(
            runtimeError('DATABASE_ERROR', { operation: 'migrate' }, detail),
          ),
        ).toBe(false);
      },
    );

    it.each([
      'locked',
      'busy',
      'ioError',
      'outOfSpace',
      'tooNew',
      'networkMismatch',
    ])('honors a structured migration reason: %s', (reason) => {
      expect(
        isZcashRuntimeDatabaseBroken(
          runtimeError('DATABASE_ERROR', { operation: 'migrate', reason }),
        ),
      ).toBe(false);
    });

    it('never treats a database from a newer app as broken', () => {
      expect(
        isZcashRuntimeDatabaseBroken(
          runtimeError('DATABASE_TOO_NEW', { unknownMigrations: 1 }),
        ),
      ).toBe(false);
    });

    it('does not rebuild for an unknown database failure or a non-database failure', () => {
      expect(
        isZcashRuntimeDatabaseBroken(
          runtimeError('DATABASE_ERROR', { operation: 'syncStep' }),
        ),
      ).toBe(false);
      expect(
        isZcashRuntimeDatabaseBroken(
          runtimeError('NETWORK_ERROR', {}, 'malformed response'),
        ),
      ).toBe(false);
      expect(isZcashRuntimeDatabaseBroken(new Error('malformed'))).toBe(false);
    });

    it.each([
      'malformed SQL statement',
      'Wallet database is corrupted: invalid account metadata',
      'Data DB is corrupted: retains checkpoints both above and below height 100',
    ])(
      'does not confuse application-level failures with damaged SQLite bytes: %s',
      (detail) => {
        expect(
          isZcashRuntimeDatabaseBroken(
            runtimeError('DATABASE_ERROR', { operation: 'syncStep' }, detail),
          ),
        ).toBe(false);
      },
    );
  },
);
