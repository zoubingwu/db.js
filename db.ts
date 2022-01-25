import repl from 'repl';
import fs from 'fs';

const dbFile = './data.db';

const map = new Map<string, Index>();
const fd = fs.openSync(dbFile, 'a+');

type Offset = number;
type Size = number; // how many bytes
type Index = [Offset, Size];

const enum DataType {
  Boolean,
  Number,
  String,
}

const get = (key: string) => {
  const index = map.get(key);

  if (index) {
    const [offset, size] = index;
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, offset);
    return deserialize(buffer);
  }

  return null;
};

const set = (key: string, value: string) => {
  let buffer: Buffer;
  if (value === 'true' || value === 'false') {
    // boolean
    buffer = serialize(JSON.parse(value));
  } else if (/^-?\d+$/.test(value)) {
    // number
    buffer = serialize(parseFloat(value));
  } else {
    buffer = serialize(value);
  }

  const size = buffer.byteLength;
  const offset = fs.statSync(dbFile).size;
  map.set(key, [offset, size]);
  fs.appendFileSync(dbFile, buffer);
};

const deserialize = (buf: Buffer): boolean | number | string => {
  const type = buf[0];

  switch (type) {
    case DataType.Boolean: {
      return buf[1] === 1;
    }
    case DataType.Number: {
      return buf.readDoubleBE(1);
    }
    case DataType.String: {
      return buf.slice(1).toString();
    }
    default:
      return buf.slice(1).toString();
  }
};

const serialize = (val: boolean | number | string): Buffer => {
  let buf: Buffer;
  let type: Buffer;
  let data: Buffer;

  switch (typeof val) {
    case 'boolean': {
      type = Buffer.alloc(1, DataType.Boolean);
      data = Buffer.alloc(1, val ? 1 : 0);
      break;
    }
    case 'number': {
      type = Buffer.alloc(1, DataType.Number);
      data = Buffer.allocUnsafe(8);
      data.writeDoubleBE(val);
      break;
    }
    case 'string': {
      type = Buffer.alloc(1, DataType.String);
      data = Buffer.from(val);
      break;
    }
    default: {
      type = Buffer.alloc(1, DataType.String);
      data = Buffer.from(val);
    }
  }

  buf = Buffer.concat([type, data]);
  return buf;
};

repl.start({
  prompt: 'db.js >> ',
  eval: async (evalCmd, _, __, callback) => {
    const cmd = evalCmd.trim();
    if (cmd.startsWith('set')) {
      const [, key, value] = cmd.split(' ');
      set(key, value);
      return callback(null, value);
    }
    if (cmd.startsWith('get')) {
      const [, key] = cmd.split(' ');
      const value = get(key);
      return callback(null, value);
    }
    return callback(null, `Unrecognized command.`);
  },
});
