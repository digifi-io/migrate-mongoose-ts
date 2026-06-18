import type { Connection, Model } from 'mongoose';

export type MigrationState = 'up' | 'down';

export type MigrationDirection = 'up' | 'down';

export interface MigrationRecord {
  name: string;
  createdAt: Date;
  state: MigrationState;
  filename: string;
}

export interface MigratorOptions {
  /** Path to a custom migration template file */
  templatePath?: string;
  /** Path to the migrations directory */
  migrationsPath?: string;
  /** MongoDB connection URI (used when `connection` is not provided) */
  dbConnectionUri?: string;
  /** MongoDB collection name for migration state */
  collectionName?: string;
  /** Import filesystem migrations into the database without prompting */
  autosync?: boolean;
  /** Enable CLI logging */
  cli?: boolean;
  /** Existing Mongoose connection (takes precedence over `dbConnectionUri`) */
  connection?: Connection;
  /** @deprecated Passed by CLI for compatibility; not used by Migrator constructor */
  es6Templates?: boolean;
  /** @deprecated Passed by CLI for compatibility; TypeScript templates are always used */
  typescript?: boolean;
}

/**
 * Bound `connection.model` helper available as `this` in migration functions.
 *
 * @example
 * export async function up() {
 *   await this('users').updateMany({}, { $set: { state: 'active' } });
 * }
 */
export type ModelGetter = (modelName: string) => Model;

/**
 * Signature for `up` / `down` exports in migration files.
 * `this` is bound to `connection.model`; an optional `connection` argument is also passed.
 */
export type MigrationFunction = (
  this: ModelGetter,
  connection?: Connection
) => void | Promise<void>;

export interface MigrationModule {
  up?: MigrationFunction;
  down?: MigrationFunction;
}

declare class Migrator {
  constructor(options: MigratorOptions);

  log(logString: string, force?: boolean): void;

  /** Replace the underlying Mongoose connection used for migration state */
  setMongooseConnection(connection: Connection): void;

  /** Close the underlying MongoDB connection */
  close(): Promise<void>;

  /** Generate a migration filename from a basename (adds `.ts` extension) */
  getMigrationFileName(basename: string): string;

  /** Create a new migration file and register it in the database */
  create(migrationName: string): Promise<MigrationRecord>;

  /**
   * Run migrations up or down.
   * @param direction - `'up'` (default) or `'down'`
   * @param migrationName - Target migration; when omitted for `up`, runs all pending migrations
   */
  run(direction?: MigrationDirection, migrationName?: string): Promise<MigrationRecord[]>;

  /**
   * Import migrations present on the filesystem but missing in the database.
   * Opposite of {@link Migrator.prune}.
   */
  sync(): Promise<MigrationRecord[]>;

  /**
   * Remove migration records from the database that have no matching filesystem file.
   * Opposite of {@link Migrator.sync}.
   */
  prune(): Promise<MigrationRecord[]>;

  /** List all migrations and their current state */
  list(): Promise<MigrationRecord[]>;
}

export default Migrator;
