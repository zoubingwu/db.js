import repl from 'repl';
import process from 'process';

import { Database, DEFAULT_DB_FILE } from './lib';

const dbFile = process.argv[2] || DEFAULT_DB_FILE;
const db = new Database(dbFile);

db.open();

repl.start({
  prompt: 'db.js >> ',
  eval: async (evalCmd, _, __, callback) => {
    const cmd = evalCmd.trim();
    if (cmd.startsWith('set')) {
      const [, key, value] = cmd.split(' ');
      return callback(null, db.set(key, value));
    }
    if (cmd.startsWith('get')) {
      const [, key] = cmd.split(' ');
      return callback(null, db.get(key));
    }
    return callback(null, `Unrecognized command.`);
  },
});
