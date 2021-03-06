import fs from 'fs';
import { Pager } from './pager';
import { BTree } from './btree';
import { Cursor } from './cursor';

export class Database {
  private readonly pager: Pager;
  private btree: BTree | null = null;

  constructor(filePath: string) {
    const isExist = fs.existsSync(filePath);
    const fd = fs.openSync(filePath, isExist ? 'r+' : 'w+');
    this.pager = new Pager(fd);
  }

  public open() {
    if (!this.pager.verifyFileHeader()) {
      throw new Error('This is not a simple db file!');
    }
    const cursor = new Cursor(this.pager);
    this.btree = new BTree(this.pager, cursor);
  }

  public set(key: string, value: string) {
    if (!this.btree) {
      throw new Error('call `db.open` first!');
    }
    let buffer: Buffer;
    if (value === 'true' || value === 'false') {
      buffer = serialize(JSON.parse(value)); // boolean
    } else if (/^-?\d+$/.test(value)) {
      buffer = serialize(parseFloat(value)); // number
    } else {
      buffer = serialize(value);
    }
    this.btree.insert(Buffer.from(key), buffer);
    return deserialize(buffer);
  }

  public get(key: string) {
    if (!this.btree) {
      throw new Error('call `db.open` first!');
    }
    const buf = this.btree.find(Buffer.from(key));
    return buf ? deserialize(buf) : null;
  }
}

export const enum DataType {
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
    default: {
      type = Buffer.alloc(1, DataType.String);
      data = Buffer.from(val);
    }
  }

  buf = Buffer.concat([type, data]);
  return buf;
}
