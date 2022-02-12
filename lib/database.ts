import fs from 'fs';
import { Pager } from './pager';
import { BTree } from './btree';

export class Database {
  private readonly fd: number;
  private readonly btree: BTree;
  private readonly pager: Pager;

  constructor(filePath: string) {
    const isExist = fs.existsSync(filePath);
    this.fd = fs.openSync(filePath, isExist ? 'r+' : 'w+');
    this.pager = new Pager(this.fd);
    this.btree = new BTree(this.pager);
  }

  public open() {
    if (!this.pager.verifyFileHeader()) {
      throw new Error('This is not a simple db file!');
    }
  }

  public set(key: string, value: string) {
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
    this.btree.insert(Buffer.from(key), buffer);

    return deserialize(buffer);
  }

  public get(key: string) {
    const buf = this.btree.find(Buffer.from(key));
    return buf ? deserialize(buf) : null;
  }
}

const enum DataType {
  Boolean,
  Number,
  String,
}

export function deserialize(buf: Buffer): boolean | number | string {
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
}

export function serialize(val: boolean | number | string): Buffer {
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
      data = Buffer.alloc(8);
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
}
