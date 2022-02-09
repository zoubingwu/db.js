import repl from 'repl';
import fs from 'fs';
import process from 'process';
import * as buffer from 'buffer';

const { Buffer } = buffer;

const DEFAULT_DB_FILE = './data.db';
const MAGIC_HEADER_STRING = 'my simpledb format\x00';
const MAGIC_HEADER_SIZE = Buffer.from(MAGIC_HEADER_STRING).length;
const FILE_HEADER_SIZE = 100;
const PAGE_SIZE = 4096;

const enum CellType {
  Pointer,
  KeyValue,
}

/**
 * 0                4               8
 * +----------------+---------------+-------------+
 * | [int] key_size | [int] page_id | [bytes] key |
 * +----------------+---------------+-------------+
 */
class PointerCell {
  public readonly type = CellType.Pointer
  public keySize: number;
  public key: Buffer;
  public childPageId: number;

  constructor(rawBuffer: Buffer) {
    this.keySize = rawBuffer.readInt32BE(0);
    this.childPageId = rawBuffer.readInt32BE(4);
    this.key = rawBuffer.slice(8, 8 + this.keySize);
  }
}

/**
 * 0              1                5                  9
 * +--------------+----------------+------------------+-------------+----------------+
 * | [byte] flags | [int] key_size | [int] value_size | [bytes] key | [bytes] value  |
 * +--------------+----------------+------------------+-------------+----------------+
 */
class KeyValueCell {
  public readonly type = CellType.KeyValue
  public keySize: number; // 2 bytes
  public key: Buffer;
  public valueSize: number;
  public value: Buffer;

  constructor(rawBuffer: Buffer) {
    this.keySize = rawBuffer.readInt16BE(1);
    this.valueSize = rawBuffer.readInt16BE(5);
    this.key = rawBuffer.slice(9, 9 + this.keySize);
    this.value = rawBuffer.slice(9 + this.keySize, 9 + this.keySize + this.valueSize);
  }
}

class Pager {
  static getPageOffsetById(id: number) {
    return id * PAGE_SIZE + FILE_HEADER_SIZE;
  }

  private readonly fd: number;

  constructor(fd: number) {
    this.fd = fd;
  }

  public getPageNodeById(id: number): BTreeNode {
    const buf = Buffer.alloc(PAGE_SIZE);
    fs.readSync(this.fd, buf, 0, PAGE_SIZE, Pager.getPageOffsetById(id));
    return new BTreeNode(buf, this);
  }
}

class BTree {
  private readonly root: BTreeNode | null;
  private readonly pager: Pager;

  constructor(pager: Pager) {
    this.pager = pager;
    this.root = this.pager.getPageNodeById(0);
  }

  public find(key: Buffer) {
    if (this.root) {
      return this.root.find(key);
    }
    return null;
  }

  public insert(key: Buffer, value: Buffer) {

  }
}

const enum PageType {
  LEAF= 0x0d,
  INTERNAL = 0x05,
}

class BTreeNodeHeader {
  public pageType: PageType;
  public freeStart: number;
  public cellCount: number;
  public cellAreaStart: number;
  public freeBytesOfCellArea: number;
  public rightMostPointer: number;

  public readonly length: number;

  constructor(rawBuffer: Buffer) {
    this.pageType = rawBuffer.readInt8(0);
    this.freeStart = rawBuffer.readInt16BE(1);
    this.cellCount = rawBuffer.readInt16BE(3);
    this.cellAreaStart = rawBuffer.readInt16BE(5);
    this.freeBytesOfCellArea = rawBuffer.readInt8(7);
    this.rightMostPointer = rawBuffer.readInt32BE(8);
    this.length = rawBuffer.length
  }
}

/**
 * Page:
 * +--------+---------------+------------+-------------------+
 * | header | cell_pointers | free_space | cell_content_area |
 * +--------+---------------+------------+-------------------+
 *
 * header fixed 12 bytes:
 * 0                  1                  3                  5                        7                               8                        12
 * +------------------+------------------+------------------+------------------------+-------------------------------+-------------------------+
 * | [int] page_type  | [int] free_start | [int] cell_count |  [int] cell_area_start | [int] free_bytes_of_cell_area | [int] rightmost_pointer |
 * +------------------+------------------+------------------+------------------------+-------------------------------+-------------------------+
 *
 * cell pointers: array of 2 bytes integer offset
 */
class BTreeNode {
  private readonly pager: Pager
  private pointerCells: PointerCell[] = [];
  private keyValueCells: KeyValueCell[] = [];
  private header: BTreeNodeHeader;

  public get type() {
    return this.header.pageType;
  }

  constructor(rawBuffer: Buffer, pager: Pager) {
    this.pager = pager;
    this.header = new BTreeNodeHeader(rawBuffer.slice(0, 12));

    let i = this.header.length;
    const cellPointers: number[] = [];
    while (i < this.header.freeStart) {
      const cellOffset = rawBuffer.readInt16BE(i);
      cellPointers.push(cellOffset);
    }
    for (let j = 0; j < cellPointers.length; j++) {
      const start = cellPointers[j];
      const end = j === cellPointers.length - 1 ? rawBuffer.length : cellPointers[j+1];
      const cellBuffer = rawBuffer.slice(start, end);
      if (this.type === PageType.INTERNAL) {
        this.pointerCells.push(new PointerCell(cellBuffer));
      } else if (this.type === PageType.LEAF) {
        this.keyValueCells.push(new KeyValueCell(cellBuffer))
      }
    }
  }

  public find(key: Buffer): Buffer | null {
    // TODO use binary search
    // the first separator key that is greater than the searched value
    if (this.type === PageType.INTERNAL) {
      const index = this.pointerCells.findIndex(cell => Buffer.compare(cell.key, key) === -1);

      if (index === -1) {
        const rightMostPage = this.pager.getPageNodeById(this.header.rightMostPointer);
        return rightMostPage.find(key);
      } else if (index === 0) {
        return  null;
      } else {
        const cell = this.pointerCells[index - 1];
        const node = this.pager.getPageNodeById(cell.childPageId);
        return node.find(key);
      }
    }

    if (this.type === PageType.LEAF) {
      const index = this.keyValueCells.findIndex(cell => Buffer.compare(cell.key, key) === 0);
      if (index === -1) {
        return null;
      } else {
        const cell = this.keyValueCells[index];
        return cell.value;
      }
    }

    return null;
  }
}

class Database {
  private readonly fd: number;
  private readonly btree: BTree;

  constructor(filePath: string) {
    const isExist = fs.existsSync(filePath);
    this.fd = fs.openSync(filePath, isExist ? 'r+' : 'w+');
    const pager = new Pager(this.fd);
    this.btree = new BTree(pager);
  }

  private checkHeader() {
    const header = Buffer.alloc(FILE_HEADER_SIZE);
    fs.readSync(this.fd, header, 0, FILE_HEADER_SIZE, 0);
    const magicHeader = header.slice(0, MAGIC_HEADER_SIZE);
    if (magicHeader.toString() !== MAGIC_HEADER_STRING) {
      throw new Error('This is not a simple db file!');
    }
  }

  private writeHeader() {
    const header = Buffer.alloc(FILE_HEADER_SIZE);
    header.write(MAGIC_HEADER_STRING, 0);
    header.writeInt16BE(PAGE_SIZE, MAGIC_HEADER_SIZE);
    fs.writeSync(this.fd, header, 0, FILE_HEADER_SIZE, 0);
  }

  public check() {
    const isEmpty = fs.fstatSync(this.fd).size === 0;
    if (isEmpty) {
      this.writeHeader();
    } else {
      this.checkHeader();
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

function deserialize(buf: Buffer): boolean | number | string {
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

function serialize(val: boolean | number | string): Buffer {
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
}

const dbFile = process.argv[2] || DEFAULT_DB_FILE;
const database = new Database(dbFile);

database.check();

repl.start({
  prompt: 'db.js >> ',
  eval: async (evalCmd, _, __, callback) => {
    const cmd = evalCmd.trim();
    if (cmd.startsWith('set')) {
      const [, key, value] = cmd.split(' ');
      database.set(key, value);
      return callback(null, value);
    }
    if (cmd.startsWith('get')) {
      const [, key] = cmd.split(' ');
      const value = database.get(key);
      return callback(null, value);
    }
    return callback(null, `Unrecognized command.`);
  },
});