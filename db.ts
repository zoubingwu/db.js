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
  public readonly type = CellType.Pointer;
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
  public readonly type = CellType.KeyValue;
  public keySize: number; // 2 bytes
  public key: Buffer;
  public valueSize: number;
  public value: Buffer;

  constructor(rawBuffer: Buffer) {
    this.keySize = rawBuffer.readInt16BE(1);
    this.valueSize = rawBuffer.readInt16BE(5);
    this.key = rawBuffer.slice(9, 9 + this.keySize);
    this.value = rawBuffer.slice(
      9 + this.keySize,
      9 + this.keySize + this.valueSize
    );
  }
}

class Pager {
  static getPageOffsetById(id: number) {
    return (id - 1) * PAGE_SIZE + FILE_HEADER_SIZE;
  }

  private readonly fd: number;

  constructor(fd: number) {
    this.fd = fd;
  }

  public readPageNodeById(id: number): Buffer {
    const buf = Buffer.alloc(PAGE_SIZE);
    fs.readSync(this.fd, buf, 0, PAGE_SIZE, Pager.getPageOffsetById(id));
    return buf;
  }

  public writePageNodeById(id: number, buf: Buffer) {
    fs.writeSync(this.fd, buf, 0, PAGE_SIZE, Pager.getPageOffsetById(id));
  }
}

class BTree {
  private readonly root: BTreeNode | null;
  private readonly pager: Pager;

  constructor(pager: Pager) {
    this.pager = pager;
    const buf = this.pager.readPageNodeById(1);
    const node = new BTreeNode(1, buf, this.pager, null);
    this.root = node.isEmptyNode() ? null : node;
  }

  public find(key: Buffer) {
    return this.root ? this.root.find(key) : null;
  }

  public insert(key: Buffer, value: Buffer) {
    if (!this.root) {
      const node = BTreeNode.createEmptyNode(PageType.LEAF);
      node.insert(key, value);
    }
  }
}

const enum PageType {
  EMPTY = 0x00,
  LEAF = 0x0d,
  INTERNAL = 0x05,
}

/**
 * header has fixed 12 bytes:
 * 0                  1                  3                  5                        7                               8                        12
 * +------------------+------------------+------------------+------------------------+-------------------------------+-------------------------+
 * | [int] page_type  | [int] free_start | [int] cell_count |  [int] cell_area_start | [int] free_bytes_of_cell_area | [int] rightmost_pointer |
 * +------------------+------------------+------------------+------------------------+-------------------------------+-------------------------+
 *
 */
class BTreeNodeHeader {
  public static readonly SIZE = 12;
  public static readonly DEFAULT_FREE_START = 12;
  public static createEmptyHeader(type: PageType): Buffer {
    const buf = Buffer.alloc(BTreeNodeHeader.SIZE);
    buf.writeInt8(type, 0);
    buf.writeInt16BE(BTreeNodeHeader.DEFAULT_FREE_START, 1);
    return buf;
  }

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
    this.length = rawBuffer.length;
  }
}

/**
 * Page:
 * 0       12            freeStart   cellAreaStart          4096
 * +--------+---------------+------------+-------------------+
 * | header | cell_pointers | free_space | cell_content_area |
 * +--------+---------------+------------+-------------------+
 *
 * cell pointers: array of 2 bytes integer indicates cell left offset
 */
class BTreeNode {
  static createEmptyNode(type: PageType): BTreeNode {
    const buf = Buffer.alloc(PAGE_SIZE);
    const header = BTreeNodeHeader.createEmptyHeader(type);
    header.copy(buf);
    return;
  }

  private readonly pager: Pager;
  private readonly cellOffsets: number[];
  private readonly pointerCells: Map<number, PointerCell>;
  private readonly keyValueCells: Map<number, KeyValueCell>;
  private readonly header: BTreeNodeHeader;

  private readonly id: number;
  private readonly parentId: number | null;

  private findChildNode(id: number): BTreeNode {
    const buf = this.pager.readPageNodeById(id);
    return new BTreeNode(id, buf, this.pager, this.id);
  }

  constructor(
    id: number,
    rawBuffer: Buffer,
    pager: Pager,
    parentId: number | null
  ) {
    this.pager = pager;

    this.header = new BTreeNodeHeader(rawBuffer.slice(0, BTreeNodeHeader.SIZE));
    this.parentId = parentId;
    this.id = id;

    let i = this.header.length;
    const cellOffsets: number[] = [];
    while (i < this.header.freeStart) {
      const cellOffset = rawBuffer.readInt16BE(i);
      cellOffsets.push(cellOffset);
    }
    this.cellOffsets = cellOffsets;
    this.cellOffsets.forEach((offset, index, array) => {
      const start = offset;
      const end =
        index === array.length - 1 ? rawBuffer.length : array[index + 1];
      const cellBuffer = rawBuffer.slice(start, end);
      if (this.isInternalNode()) {
        this.pointerCells.set(offset, new PointerCell(cellBuffer));
      } else if (this.isLeafNode()) {
        this.keyValueCells.set(offset, new KeyValueCell(cellBuffer));
      }
    });
  }

  public isLeafNode() {
    return this.header.pageType === PageType.LEAF;
  }

  public isInternalNode() {
    return this.header.pageType === PageType.INTERNAL;
  }

  public isEmptyNode() {
    return this.header.pageType === 0;
  }

  public find(key: Buffer): Buffer | null {
    // TODO use binary search
    if (this.isInternalNode()) {
      const index = this.cellOffsets.findIndex(
        offset => Buffer.compare(this.pointerCells.get(offset).key, key) === -1
      );

      if (index === -1) {
        const id = this.header.rightMostPointer;
        const rightMostPage = this.findChildNode(id);
        return rightMostPage.find(key);
      } else if (index === 0) {
        return null;
      } else {
        const cell = this.pointerCells.get(this.cellOffsets[index - 1]);
        const node = this.findChildNode(cell.childPageId);
        return node.find(key);
      }
    }

    if (this.isLeafNode()) {
      const index = this.cellOffsets.findIndex(
        offset => Buffer.compare(this.keyValueCells.get(offset).key, key) === 0
      );
      if (index === -1) {
        return null;
      } else {
        const cell = this.keyValueCells.get(this.cellOffsets[index]);
        return cell.value;
      }
    }

    return null;
  }

  public insert(key: Buffer, value: Buffer) {}
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
const db = new Database(dbFile);

db.check();

repl.start({
  prompt: 'db.js >> ',
  eval: async (evalCmd, _, __, callback) => {
    const cmd = evalCmd.trim();
    if (cmd.startsWith('set')) {
      const [, key, value] = cmd.split(' ');
      db.set(key, value);
      return callback(null, value);
    }
    if (cmd.startsWith('get')) {
      const [, key] = cmd.split(' ');
      const value = db.get(key);
      return callback(null, value);
    }
    return callback(null, `Unrecognized command.`);
  },
});
