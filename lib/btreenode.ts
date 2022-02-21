import { PointerCell, KeyValueCell } from './cell';
import { PAGE_SIZE } from './constant';
import type { BTree } from './btree';

export const enum PageType {
  EMPTY = 0x00,
  LEAF = 0x0d,
  INTERNAL = 0x05,
}

/**
 * Page:
 * 0        8            freeStart   cellAreaStart          4096
 * +--------+---------------+------------+-------------------+
 * | header | cell_pointers | free_space | cell_content_area |
 * +--------+---------------+------------+-------------------+
 *
 *
 * header has fixed 8 bytes
 * 0                  1                  3                       5           8
 * +------------------+------------------+-----------------------+-----------+
 * | [int] page_type  | [int] free_start | [int] cell_area_start | reserved  |
 * +------------------+------------------+-----------------------+-----------+
 *
 *
 * cell pointers: array of 2 bytes integer indicates cell left offset
 */

export class BTreeNode {
  public static readonly HEADER_SIZE = 8;
  public static readonly DEFAULT_FREE_START = 8;
  public static readonly DEFAULT_CELL_START = PAGE_SIZE;
  public static readonly CELL_AREA_END = PAGE_SIZE;
  public static readonly CELL_POINTER_SIZE = 2;

  public static isEqualKey(a: Buffer, b: Buffer) {
    return Buffer.compare(a, b) === 0;
  }

  public static createEmptyHeader(): Buffer {
    const buf = Buffer.alloc(BTreeNode.HEADER_SIZE);
    buf.writeInt8(PageType.EMPTY, 0); // page_type
    buf.writeInt16BE(BTreeNode.DEFAULT_FREE_START, 1); // free_start
    buf.writeInt16BE(BTreeNode.DEFAULT_CELL_START, 3); // cell_area_start
    return buf;
  }

  public readonly id: number;
  public readonly buffer: Buffer;

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

  private get cellAreaStart(): number {
    return this.buffer.readInt16BE(3);
  }

  private set cellAreaStart(n: number) {
    this.buffer.writeUInt16BE(n, 3);
  }

  private get cellOffsets(): number[] {
    let i = BTreeNode.HEADER_SIZE;
    const buf = this.buffer;
    const res = [];
    while (i < this.freeStart) {
      const offset = buf.readInt16BE(i);
      res.push(offset);
      i += BTreeNode.CELL_POINTER_SIZE;
    }
    return res;
  }

  private set cellOffsets(offsets: number[]) {
    const cellPointers = Buffer.concat(
      offsets.map(val => {
        const buf = Buffer.alloc(BTreeNode.CELL_POINTER_SIZE);
        buf.writeInt16BE(val);
        return buf;
      })
    );
    cellPointers.copy(this.buffer, BTreeNode.HEADER_SIZE);
  }

  private readCellByIndex(index: number): PointerCell | KeyValueCell | null {
    const ptrs = this.cellOffsets;
    const ptr = ptrs.at(index);
    if (typeof ptr === 'undefined') {
      return null;
    }
    return this.readCellByPointer(ptr);
  }

  private readCellByPointer(ptr: number) {
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

    return null;
  }

  private readCellByKey(key: Buffer) {
    const currentCellOffsets = this.cellOffsets;
    let i = binaryFindFirstGreatorElement(currentCellOffsets, key, (a, b) =>
      Buffer.compare(this.readCellByPointer(a)!.key, b)
    );

    if (i === 0) {
      // first key is greator
      return null;
    } else if (i > 0) {
      // the one at i is greator, try compare it with previous one
      i = i - 1;
    } else {
      // none of them is greator, so try compare it with last key
      i = -1;
    }

    const cell = this.readCellByIndex(i);
    if (cell && BTreeNode.isEqualKey(cell.key, key)) {
      return cell;
    }
    return null;
  }

  private insertCell(cell: KeyValueCell | PointerCell) {
    const currentCellOffsets = this.cellOffsets;
    const offset = cell.offset;

    const i = binaryFindFirstGreatorElement(
      currentCellOffsets,
      cell.key,
      (a, b) => Buffer.compare(this.readCellByPointer(a)!.key, b)
    );

    if (i === -1) {
      const c = this.readCellByIndex(-1);
      if (c && BTreeNode.isEqualKey(c.key, cell.key)) {
        currentCellOffsets.pop();
      }
      currentCellOffsets.push(offset);
    } else if (i === 0) {
      currentCellOffsets.unshift(offset);
    } else {
      const c = this.readCellByIndex(i - 1);
      if (c && BTreeNode.isEqualKey(c.key, cell.key)) {
        currentCellOffsets.splice(i - 1, 1, offset); // replace it if it was equal
      } else {
        currentCellOffsets.splice(i, 0, offset); // otherwise put it after i - 1 position
      }
    }

    cell.buffer.copy(this.buffer, this.cellAreaStart - cell.size);
    this.cellOffsets = currentCellOffsets;
    this.freeStart = this.freeStart + BTreeNode.CELL_POINTER_SIZE;
    this.cellAreaStart = offset;
  }

  constructor(id: number, rawBuffer: Buffer) {
    this.id = id;
    this.buffer = rawBuffer;
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

  public firstKey() {
    return this.readCellByIndex(0)?.key!;
  }

  public lastKey() {
    const cellOffsets = this.cellOffsets;
    return this.readCellByIndex(cellOffsets.length - 1)?.key!;
  }

  public keys() {
    return this.cellOffsets.map(p => this.readCellByPointer(p)!.key);
  }

  public keyAt(n: number) {
    return this.readCellByIndex(n)?.key ?? null;
  }

  public keyCount(): number {
    return this.cellOffsets.length;
  }

  public canHold(key: Buffer, value: Buffer | null) {
    const cellSize = value
      ? KeyValueCell.calcSize(key.length, value.length)
      : PointerCell.calcSize(key.length);

    return (
      this.cellAreaStart - this.freeStart >
      BTreeNode.CELL_POINTER_SIZE + cellSize
    );
  }

  /**
   * @param key Buffer
   * @returns pointer to subtree or leaf node that contains key
   */
  public findSubtreeOrLeaf(key: Buffer): BTreeNode | number {
    if (this.isInternalNode()) {
      const currentCellOffsets = this.cellOffsets;
      const index = binaryFindFirstGreatorElement(
        currentCellOffsets,
        key,
        (a, b) => Buffer.compare(this.readCellByPointer(a)!.key, b)
      );

      let cell: PointerCell;
      if (index === -1) {
        // the key is greator than or equal to last element
        cell = this.readCellByIndex(-1)! as PointerCell;
      } else if (index === 0) {
        // the key is lesser the first element
        cell = this.readCellByIndex(0)! as PointerCell;
      } else {
        // the key is lesser than element at index, so we return the previous one of index
        cell = this.readCellByIndex(index - 1)! as PointerCell;
      }
      return cell.childPageId;
    } else if (this.isEmptyNode()) {
      // is newly created root node
      return this;
    } else {
      // is leaf node
      return this;
    }
  }

  public findKeyValueCell(key: Buffer): KeyValueCell | null {
    if (!this.isLeafNode()) {
      return null;
    }

    const c = this.readCellByKey(key);
    return c ? (c as KeyValueCell) : null;
  }

  public insertKeyValueCell(key: Buffer, value: Buffer) {
    if (this.isEmptyNode()) {
      this.pageType = PageType.LEAF;
    }
    const size = KeyValueCell.calcSize(key.length, value.length);
    const offset = this.cellAreaStart - size;
    const cell = KeyValueCell.create(key, value, offset);
    this.insertCell(cell);
  }

  public insertPointerCell(key: Buffer, pointer: number) {
    if (this.isEmptyNode()) {
      this.pageType = PageType.INTERNAL;
    }
    const size = PointerCell.calcSize(key.length);
    const offset = this.cellAreaStart - size;
    const cell = PointerCell.create(key, pointer, offset);
    this.insertCell(cell);
  }

  /**
   * 1. Allocate a new node.
   * 2. Copy half the elements from the splitting node to the new one.
   * 3. Place the new element into the corresponding node.
   * 4. At the parent of the split node, add a separator key and a pointer to the new node.
   *
   * @param key
   * @param valueOrPointer
   * @param newNode
   * @param cursor
   */
  public splitAndInsert(
    key: Buffer,
    valueOrPointer: Buffer | number,
    btree: BTree
  ) {
    const [id, buffer] = btree.pager.allocNewPage();
    const newNode = new BTreeNode(id, buffer);
    const ptrs = this.cellOffsets;

    // Copy latter half of cells to new node
    const latterHalfOfPtrs = ptrs.slice(Math.floor(ptrs.length / 2));
    for (const p of latterHalfOfPtrs) {
      if (this.isInternalNode()) {
        const cell = this.readCellByPointer(p)! as PointerCell;
        newNode.insertPointerCell(cell.key, cell.childPageId);
      } else if (this.isLeafNode()) {
        const cell = this.readCellByPointer(p)! as KeyValueCell;
        newNode.insertKeyValueCell(cell.key, cell.value);
      }
    }

    // Only keep former half of cells in current node, this will reset buffer
    const formerHalfOfPtrs = ptrs.slice(0, Math.floor(ptrs.length / 2));
    const buf = Buffer.concat(
      formerHalfOfPtrs.map(p => this.readCellByPointer(p)!.buffer)
    );
    this.buffer.fill(0, this.cellAreaStart, BTreeNode.CELL_AREA_END); // reset all cells
    buf.copy(this.buffer, BTreeNode.DEFAULT_CELL_START - buf.length);
    this.cellOffsets = formerHalfOfPtrs;
    this.freeStart =
      BTreeNode.DEFAULT_FREE_START +
      BTreeNode.CELL_POINTER_SIZE * formerHalfOfPtrs.length;
    this.cellAreaStart = BTreeNode.DEFAULT_CELL_START - buf.length;

    // Place the new element into the corresponding node.
    if (Buffer.compare(key, newNode.firstKey()) === -1) {
      if (this.isLeafNode()) {
        this.insertKeyValueCell(key, valueOrPointer as Buffer);
      } else if (this.isInternalNode()) {
        this.insertPointerCell(key, valueOrPointer as number);
      }
    } else {
      if (this.isLeafNode()) {
        newNode.insertKeyValueCell(key, valueOrPointer as Buffer);
      } else if (this.isInternalNode()) {
        newNode.insertPointerCell(key, valueOrPointer as number);
      }
    }

    const parent = btree.cursor.prev();

    if (!parent) {
      // it indicates current node is root node
      btree.createRootAndIncreaseHeight(newNode);
      btree.saveNodeToFile(this);
      btree.saveNodeToFile(newNode);
    } else if (parent.canHold(newNode.firstKey(), null)) {
      // parent node can hold pointer to new node
      parent.insertPointerCell(newNode.firstKey(), newNode.id);
      btree.saveNodeToFile(parent);
      btree.saveNodeToFile(this);
      btree.saveNodeToFile(newNode);
      if (parent.id === btree.root?.id) {
        btree.root = parent;
      }
    } else {
      // parent node does not have enough space to hold pointer to new node
      // should keep split and propagate
      parent.splitAndInsert(newNode.firstKey(), newNode.id, btree);
    }
  }
}

/**
 * do binary search to find the first greator element
 * @returns index of the first greator element
 */
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
