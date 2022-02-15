import { Pager } from './pager';
import { PointerCell, KeyValueCell } from './cell';
import { PAGE_SIZE } from './constant';

const enum PageType {
  EMPTY = 0x00,
  LEAF = 0x0d,
  INTERNAL = 0x05,
}

export class BTree {
  private root: BTreeNode | null;
  private readonly pager: Pager;

  private findLeafNodeByKey(key: Buffer) {}

  constructor(pager: Pager) {
    this.pager = pager;
    const buf = this.pager.readPageNodeById(1);
    const node = new BTreeNode(1, buf, this.pager, null);
    this.root = node.isEmptyNode() ? null : node;
  }

  public find(key: Buffer): Buffer | null {
    return this.root ? this.root.find(key) : null;
  }

  public insert(key: Buffer, value: Buffer) {
    if (!this.root) {
      const [id, buf] = this.pager.allocNewPage();
      this.root = new BTreeNode(id, buf, this.pager, null);
      this.root.insert(key, value);
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

  private readonly pager: Pager;
  private readonly cells: Map<number, PointerCell | KeyValueCell> = new Map();

  private readonly id: number;

  private readonly parentId: number | null;
  private readonly buffer: Buffer;

  private findChildNode(id: number): BTreeNode {
    const buf = this.pager.readPageNodeById(id);
    return new BTreeNode(id, buf, this.pager, this.id);
  }

  private *traverseCell() {
    let i = BTreeNode.HEADER_SIZE;
    const buf = this.buffer;
    while (i < this.freeStart) {
      const cellOffset = buf.readInt16BE(i);
      if (this.isInternalNode()) {
        const keySize = buf.readInt32BE(cellOffset);
        const size = PointerCell.calcSize(keySize);
        const cellBuf = buf.slice(cellOffset, cellOffset + size);
        yield [cellOffset, new PointerCell(cellBuf)] as const;
      } else if (this.isLeafNode()) {
        const keySize = buf.readInt32BE(cellOffset + 1);
        const valueSize = buf.readInt32BE(cellOffset + 5);
        const size = KeyValueCell.calcSize(keySize, valueSize);
        const cellBuf = buf.slice(cellOffset, cellOffset + size);
        yield [cellOffset, new KeyValueCell(cellBuf)] as const;
      }
      i += 2;
    }
  }

  private insertCell(cell: KeyValueCell | PointerCell) {
    const currentCellOffsets = this.cellOffsets;
    const offset = this.cellAreaStart - cell.size;
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

  private persist() {
    this.pager.writePageNodeById(this.id, this.buffer);
  }

  constructor(
    id: number,
    rawBuffer: Buffer,
    pager: Pager,
    parentId: number | null
  ) {
    this.buffer = rawBuffer;
    this.pager = pager;

    this.parentId = parentId;
    this.id = id;

    for (const [offset, cell] of this.traverseCell()) {
      this.cells.set(offset, cell);
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

  public find(key: Buffer): Buffer | null {
    const currentCellOffsets = this.cellOffsets;

    if (currentCellOffsets.length === 0) {
      return null;
    }

    const index = binaryFindFirstGreatorElement(
      currentCellOffsets,
      key,
      (a, b) => Buffer.compare(this.cells.get(a)!.key, b)
    );

    if (this.isInternalNode()) {
      if (index === -1) {
        const id = this.rightMostPointer;
        const rightMostPage = this.findChildNode(id);
        return rightMostPage.find(key);
      } else if (index === 0) {
        return null;
      } else {
        const cell = this.cells.get(
          currentCellOffsets[index - 1]
        )! as PointerCell;
        const node = this.findChildNode(cell.childPageId);
        return node.find(key);
      }
    }

    if (this.isLeafNode()) {
      if (index === 0) {
        return null;
      } else {
        const cell = this.cells.get(
          index === -1
            ? currentCellOffsets.at(-1)!
            : currentCellOffsets.at(index - 1)!
        )! as KeyValueCell;
        return Buffer.compare(key, cell.key) === 0 ? cell.value : null;
      }
    }

    return null;
  }

  public insert(key: Buffer, value: Buffer) {
    if (this.isEmptyNode()) {
      this.pageType = PageType.LEAF;
      const cell = KeyValueCell.create(key, value);
      this.insertCell(cell);
      this.persist();
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
