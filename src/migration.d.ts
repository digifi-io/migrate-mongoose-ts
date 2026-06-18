import type { Connection, Model } from 'mongoose';

/**
 * Types for authoring migration files.
 *
 * @example
 * import type { MigrationFunction } from '@digifi/migrate-mongoose-ts/migration';
 *
 * export const up: MigrationFunction = async function () {
 *   await this('users').updateMany({}, { $set: { state: 'active' } });
 * };
 *
 * export const down: MigrationFunction = async function () {
 *   await this('users').updateMany({}, { $unset: { state: 1 } });
 * };
 */

export type MigrationState = 'up' | 'down';

export type ModelGetter = (modelName: string) => Model;

export type MigrationFunction = (
  this: ModelGetter,
  connection?: Connection
) => void | Promise<void>;

export interface MigrationModule {
  up?: MigrationFunction;
  down?: MigrationFunction;
}
