#! /usr/bin/env node

import path from 'path';
import yargs from 'yargs';
import 'colors';
import dotenv from 'dotenv';
import Migrator from './lib';
import mongoose from "mongoose";

dotenv.config();
let  { argv: args } = yargs
  .usage("Usage: migrate -d <mongo-uri> [[create|up|down <migration-name>]|list] [optional options]")
  .demand(1)
  .default('config', 'migrate')
  .config(
    'config',
    'filepath to an options configuration json file',
    pathToConfigFile => {
      // Get any args from env vars
      const envs = process.env;
      const envVarOptions = {};
      Object.keys(envs).map((key) => {
        if (key.includes('MIGRATE_')) {
          const [, option] = key.match(/MIGRATE_(.*$)/);
          envVarOptions[option] = envs[key];
        }
      });

      let configOptions = {};
      try {
        configOptions = require(pathToConfigFile)
      } catch (err) { /* noop */ }
      return Object.assign({}, configOptions, envVarOptions);
    }
  )

  .command('list'.cyan, 'Lists all migrations and their current state.')
  .example('$0 list')

  .command('create <migration-name>'.cyan, 'Creates a new migration file.')
  .example('$0 create add_users')

  .command('up [migration-name]'.cyan,
    'Migrates all the migration files that have not yet been run in chronological order. ' +
    'Not including [migration-name] will run UP on all migrations that are in a DOWN state.')
  .example('$0 up add_user')

  .command('down <migration-name>'.cyan, 'Rolls back migrations down to given name (if down function was provided)')
  .example('$0 down delete_names')

  .command('prune'.cyan, 'Allows you to delete extraneous migrations by removing extraneous local migration files/database migrations.')
  .example('$0 prune')
  .option('collection', {
    type: 'string',
    default: 'migrations',
    description: 'The collection to use for the migrations',
    nargs: 1
  })
  .option('d', {
    demand: true,
    type: 'string',
    alias: 'dbConnectionUri',
    description: 'The URI of the database connection'.yellow,
    nargs: 1
  })
  .option('es6', {
    type: 'boolean',
    description: 'use es6 migration template?'
  })
  .option('typescript', {
    type: 'boolean',
    description: 'use typescript migration template?'
  })
  .option('md', {
    alias: 'migrations-dir',
    description: 'The path to the migration files',
    normalize: true,
    default: './migrations',
    nargs: 1
  })
  .option('t', {
    alias: 'template-file',
    description: 'The template file to use when creating a migration',
    type: 'string',
    normalize: true,
    nargs: 1
  })

  .option('c', {
    alias: 'change-dir',
    type: 'string',
    normalize:'true',
    description: 'Change current working directory before running anything',
    nargs: 1
  })

  .option('autosync', {
    type: 'boolean',
    description: 'Automatically add new migrations in the migrations folder to the database instead of asking interactively'
  })

  .help('h')
  .alias('h', 'help');

// Destructure the command and following argument
const [ command, migrationName = args['migration-name'] ] = args._;

if (!command) process.exit(1);

// Change directory before anything if the option was provided
if (args.c) process.chdir(args.c);

// Make sure we have a connection URI
if (!args.dbConnectionUri) {
  console.error('You need to provide the Mongo URI to persist migration status.\nUse option --dbConnectionUri / -d to provide the URI.'.red);
  process.exit(1);
}

const initializeMigrator = async () => {
  const connection = await mongoose.connect(args.dbConnectionUri, {
    autoCreate: false,
  });
  const migrator = new Migrator({
    migrationsPath: path.resolve(args['migrations-dir']),
    templatePath: args['template-file'],
    connection,
    es6Templates: args.es6,
    typescript: args.typescript,
    collectionName: args.collection,
    autosync: args.autosync,
    cli: true
  });
  process.on('SIGINT', () => {
    migrator.close().then(() => {
      process.exit(0);
    });
  });

  process.on('exit', () => {
    // NOTE: This is probably useless since close is async and 'exit' does not wait for the code to finish before
    // exiting ther process, so it's a race condition between exiting and closing.
    migrator.close();
  });

  return migrator;
}

const onFinish = () => {
  process.exit(0);
}

const onError = (err) => {
  console.warn(err.message.yellow);
  if (err.message === 'There are no migrations to run') {
    process.exit(0);
  }
  process.exit(1);
}

switch(command) {
  case 'create':
    validateSubArgs({ min: 1, max: 1, desc: 'You must provide only the name of the migration to create.'.red });
    (async () => {
      const migrator = await initializeMigrator();
      migrator.create(migrationName).then(onFinish).then(()=> {
        console.log(`Migration created. Run `+ `mongoose-migrate up ${migrationName}`.cyan + ` to apply the migration.`);
      }).catch(onError);
    })();
    break;
  case 'up':
    validateSubArgs({ max: 1, desc: 'Command "up" takes 0 or 1 arguments'.red });
    (async () => {
      const migrator = await initializeMigrator();
      migrator.run('up', migrationName).then(onFinish).catch(onError);
    })();
    break;
  case 'down':
    validateSubArgs({ min: 1, max: 1, desc: 'You must provide the name of the migration to stop at when migrating down.'.red });
    (async () => {
      const migrator = await initializeMigrator();
      migrator.run('down', migrationName).then(onFinish).catch(onError);
    })();
    break;
  case 'list':
    validateSubArgs({ max: 0, desc: 'Command "list" does not take any arguments'.yellow });
    (async () => {
      const migrator = await initializeMigrator();
      migrator.list().then(onFinish).catch(onError);
    })();
    break;
  case 'prune':
    validateSubArgs({ max: 0, desc: 'Command "prune" does not take any arguments'.yellow });
    (async () => {
      const migrator = await initializeMigrator();
      migrator.prune().then(onFinish).catch(onError);
    })();
    break;
  default:
    yargs.showHelp();
    process.exit(0);
}

function validateSubArgs({ min = 0, max = Infinity, desc }) {
  const argsLen = args._.length - 1;
  if (argsLen < min || argsLen > max) {
    yargs.showHelp();
    console.error(desc);
    process.exit(-1);
  }
}
