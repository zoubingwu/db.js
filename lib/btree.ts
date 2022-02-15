import { Pager } from './pager';
import { PointerCell, KeyValueCell } from './cell';
import { PAGE_SIZE } from './constant';
import { Cursor } from './cursor';

const enum PageType {
  EMPTY = 0x00,
  LEAF = 0x0d,
  INTERNAL = 0x05,
}

export class BTree {
  private root: BTreeNode | null;
  private readonly pager: Pager;
  private readonly cursor: Cursor;

  constructor(pager: Pager) {
    this.pager = pager;
    this.cursor = new Cursor(this.pager);
    const node = this.cursor.getRoot();
    this.root = node.isEmptyNode() ? null : node;
  }

  public find(key: Buffer): Buffer | null {
    if (this.root) {
      this.cursor.reset();
      const node = this.cursor.findLeafNodeByKey(this.root, key);
      return node?.findKeyValueCell(key)?.value ?? null;
    }
    return null;
  }

  public insert(key: Buffer, value: Buffer) {
    if (!this.root) {
      const [id, buf] = this.pager.allocNewPage();
      this.root = new BTreeNode(id, buf);
      this.root.insert(key, value);
      this.pager.writePageById(this.root.id, this.root.buffer);
      return;
    }
  }
}

/**
 * Page:
 * 0       12            freeStart   cellAreaStart          4096
 * +--------+---------------+------------+-------------------+
 * | header | cell_pointers | free_space | cell_content_area |
 * +--------+---------------+------------+-------------------+
 *
 *
 * header has fixed 12 bytes:
 * 0                  1                  3                  5                        7                               8                        12
 * +------------------+------------------+------------------+------------------------+-------------------------------+-------------------------+
 * | [int] page_type  | [int] free_start | [int] cell_count |  [int] cell_area_start | [int] free_bytes_of_cell_area | [int] rightmost_pointer |
 * +------------------+------------------+------------------+------------------------+-------------------------------+-------------------------+
 *
 *
 * cell pointers: array of 2 bytes integer indicates cell left offset
 */

export class BTreeNode {
  public static readonly HEADER_SIZE = 12;
  public static readonly DEFAULT_HEADER_FREE_START = 12;
  public static readonly DEFAULT_HEADER_CELL_START = PAGE_SIZE;
  public static readonly CELL_POINTER_SIZE = 2;

  public static createEmptyHeader(): Buffer {
    const buf = Buffer.alloc(BTreeNode.HEADER_SIZE);
    buf.writeInt8(PageType.EMPTY, 0); // page_type
    buf.writeInt16BE(BTreeNode.DEFAULT_HEADER_FREE_START, 1); // free_start
    buf.writeInt16BE(0, 3); // cell_count
    buf.writeInt16BE(BTreeNode.DEFAULT_HEADER_CELL_START, 5); // cell_area_start
    return buf;
  }

  // header
  private get pageType(): PageType {
    return this.buffer.readInt8(0);
  }

  private set pageType(t: PageType) {
    this.buffer.writeUInt8(t);
  }

  private get freeStart(): number {
    return this.buffer.readInt16BE(1);
  }

  private set freeStart(n: number) {
    this.buffer.writeUInt16BE(n, 1);
  }

  private get cellCount(): number {
    return this.buffer.readInt16BE(3);
  }

  private set cellCount(n: number) {
    this.buffer.writeUInt16BE(n, 3);
  }

  private get cellAreaStart(): number {
    return this.buffer.readInt16BE(5);
  }

  private set cellAreaStart(n: number) {
    this.buffer.writeUInt16BE(n, 5);
  }

  //@ts-ignore
  private get freeBytesOfCellArea(): number {
    return this.buffer.readInt8(7);
  }

  private get rightMostPointer(): number {
    return this.buffer.readInt32BE(8);
  }

  private get cellOffsets(): number[] {
    let i = BTreeNode.HEADER_SIZE;
    const buf = this.buffer;
    const res = [];
    while (i < this.freeStart) {
      const offset = buf.readInt16BE(i);
      res.push(offset);
      i += 2;
    }
    return res;
  }

  private set cellOffsets(offsets: number[]) {
    const cellPointers = Buffer.concat(
      offsets.map(val => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(val);
        return buf;
      })
    );
    cellPointers.copy(this.buffer, BTreeNode.HEADER_SIZE);
  }

  private getCellPointerByIndex(i: number): number | null {
    const positionOfcellPointer =
      BTreeNode.HEADER_SIZE + i * BTreeNode.CELL_POINTER_SIZE;
    if (positionOfcellPointer < this.freeStart) {
      return this.buffer.readInt16BE(positionOfcellPointer);
    }
    return null;
  }

  private readCellByIndex(index: number): PointerCell | KeyValueCell | null {
    const ptr = this.getCellPointerByIndex(index);
    if (ptr !== null) {
      const buf = this.buffer;
      if (this.isInternalNode()) {
        const keySize = buf.readInt32BE(ptr);
        const size = PointerCell.calcSize(keySize);
        const cellBuf = buf.slice(ptr, ptr + size);
        return new PointerCell(cellBuf, ptr);
      } else if (this.isLeafNode()) {
        const keySize = buf.readInt32BE(ptr + 1);
        const valueSize = buf.readInt32BE(ptr + 5);
        const size = KeyValueCell.calcSize(keySize, valueSize);
        const cellBuf = buf.slice(ptr, ptr + size);
        return new KeyValueCell(cellBuf, ptr);
      }
    }
    return null;
  }

  private readonly cells: Map<number, PointerCell | KeyValueCell> = new Map();

  public readonly id: number;
  public readonly buffer: Buffer;

  private *traverseCell() {
    let i = 0;
    while (true) {
      const cell = this.readCellByIndex(i);
      if (cell === null) {
        break;
      } else {
        yield cell;
        i++;
      }
    }
  }

  private insertCell(cell: KeyValueCell | PointerCell) {
    const currentCellOffsets = this.cellOffsets;
    const offset = cell.offset;
    cell.buffer.copy(this.buffer, offset);

    const i = binaryFindFirstGreatorElement(
      currentCellOffsets,
      cell.key,
      (a, b) => Buffer.compare(this.cells.get(a)!.key, b)
    );

    if (i === -1) {
      currentCellOffsets.push(offset);
    } else if (i === 0) {
      currentCellOffsets.unshift(offset);
    } else {
      currentCellOffsets.splice(i, 1, offset);
    }
    this.cells.set(offset, cell);
    this.cellOffsets = currentCellOffsets;
    this.cellCount = this.cellCount + 1;
    this.freeStart = this.freeStart + 2;
    this.cellAreaStart = offset;
  }

  constructor(id: number, rawBuffer: Buffer) {
    this.id = id;
    this.buffer = rawBuffer;

    for (const cell of this.traverseCell()) {
      this.cells.set(cell.offset, cell);
    }
  }

  public isEmptyNode() {
    return this.pageType === PageType.EMPTY;
  }

  public isLeafNode() {
    return this.pageType === PageType.LEAF;
  }

  public isInternalNode() {
    return this.pageType === PageType.INTERNAL;
  }

  /**
   * @param key Buffer
   * @returns subtree or leaf node that contains key
   */
  public findSubnode(key: Buffer): BTreeNode | number | null {
    const currentCellOffsets = this.cellOffsets;
    if (currentCellOffsets.length === 0) {
      return null;
    }

    if (this.isInternalNode()) {
      const index = binaryFindFirstGreatorElement(
        currentCellOffsets,
        key,
        (a, b) => Buffer.compare(this.cells.get(a)!.key, b)
      );

      if (index === -1) {
        return this.rightMostPointer;
      } else if (index === 0) {
        return null;
      } else {
        const cell = this.cells.get(
          currentCellOffsets[index - 1]
        )! as PointerCell;
        return cell.childPageId;
      }
    }

    if (this.isLeafNode()) {
      return this;
    }

    return null;
  }

  public findKeyValueCell(key: Buffer): KeyValueCell | null {
    if (!this.isLeafNode()) {
      return null;
    }
    const currentCellOffsets = this.cellOffsets;
    if (currentCellOffsets.length === 0) {
      return null;
    }
    const index = binaryFindFirstGreatorElement(
      currentCellOffsets,
      key,
      (a, b) => Buffer.compare(this.cells.get(a)!.key, b)
    );

    if (index === 0) {
      return null;
    } else {
      const cell = this.cells.get(
        index === -1
          ? currentCellOffsets.at(-1)!
          : currentCellOffsets.at(index - 1)!
      )! as KeyValueCell;
      return Buffer.compare(key, cell.key) === 0 ? cell : null;
    }
  }

  public insert(key: Buffer, value: Buffer) {
    if (this.isEmptyNode()) {
      this.pageType = PageType.LEAF;
      const size = KeyValueCell.calcSize(key.length, value.length);
      const offset = this.cellAreaStart - size;
      const cell = KeyValueCell.create(key, value, offset);
      this.insertCell(cell);
      return;
    }
  }
}

export function binaryFindFirstGreatorElement<T, K>(
  array: T[],
  target: K,
  comparator: (
    current: T,
    target: K,
    currentIndex?: number,
    arr?: T[]
  ) => number
): number {
  let start = 0;
  let end = array.length - 1;
  let index = -1;

  while (start <= end) {
    let mid = Math.floor((start + end) / 2);

    const cmp = comparator(array[mid], target, mid, array);

    // move to right side if target is greater.
    if (cmp <= 0) {
      start = mid + 1;
    }

    // move left side.
    else {
      index = mid;
      end = mid - 1;
    }
  }

  return index;
}
