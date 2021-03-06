import fs from 'fs';

import { BTreeNode } from './btreenode';
import {
  PAGE_SIZE,
  FILE_HEADER_SIZE,
  MAGIC_HEADER,
  MAGIC_HEADER_SIZE,
} from './constant';

/**
 * file header, FIXED 100 bytes:
 *
 * 0                             19                21                  25                    29            100
 * +------------------------------+-----------------+-------------------+--------------------+--------------+
 * | [buffer] magic_header_string | [int] page_size | [int] max_page_id | [int] root_page_id | unused_space |
 * +------------------------------+-----------------+-------------------+--------------------+--------------+
 */
export class FileHeader {
  public static create(): FileHeader {
    const header = Buffer.alloc(FILE_HEADER_SIZE);
    MAGIC_HEADER.copy(header); // magic header 19 bytes
    header.writeInt16BE(PAGE_SIZE, MAGIC_HEADER_SIZE); // page size 2 bytes
    header.writeInt32BE(0, 21); // max page id, 4 bytes
    header.writeInt32BE(0, 25); // root page id, 4 bytes
    return new FileHeader(header);
  }

  public readonly buffer: Buffer;

  constructor(buf: Buffer) {
    this.buffer = buf;
  }

  public get maxPageId(): number {
    const curr = this.buffer.readInt32BE(21);
    this.buffer.writeInt32BE(curr + 1, 21);
    return curr;
  }

  public get rootPageId(): number {
    return this.buffer.readInt32BE(25);
  }

  public set rootPageId(n: number) {
    this.buffer.writeInt32BE(n, 25);
  }

  public verify(): boolean {
    return this.buffer.slice(0, MAGIC_HEADER_SIZE).compare(MAGIC_HEADER) === 0;
  }
}

export class Pager {
  public static getPageOffsetById(id: number) {
    return (id - 1) * PAGE_SIZE + FILE_HEADER_SIZE;
  }

  private readonly fd: number; // -1 for in-memory storage
  private header: FileHeader | null = null;

  private saveHeaderToFile() {
    if (this.header) {
      fs.writeSync(this.fd, this.header.buffer, 0, FILE_HEADER_SIZE, 0);
    }
  }

  constructor(fd: number) {
    this.fd = fd;
  }

  /**
   * Alloc an empty page and will increase max page id in header.
   * This will write to disk to save file header and empty page
   * @returns [id, buffer] as tuple
   */
  public allocNewPage(): [number, Buffer] {
    if (!this.header) {
      throw new Error('file header not initialized');
    }
    const buf = Buffer.alloc(PAGE_SIZE);
    const header = BTreeNode.createEmptyHeader();
    header.copy(buf);
    const id = this.header.maxPageId + 1;
    this.saveHeaderToFile();
    this.writePageById(id, buf);
    return [id, buf];
  }

  /**
   * Check header is legal.
   * This will write to disk to save newly created file header if file is empty.
   * @returns boolean
   */
  public verifyFileHeader(): boolean {
    const isEmpty = fs.fstatSync(this.fd).size === 0;
    if (isEmpty) {
      this.header = FileHeader.create();
      this.saveHeaderToFile();
    } else {
      const header = Buffer.alloc(FILE_HEADER_SIZE);
      fs.readSync(this.fd, header, 0, FILE_HEADER_SIZE, 0);
      this.header = new FileHeader(header);
    }
    return this.header.verify();
  }

  public readRootPage(): [number, Buffer | null] {
    if (!this.header) {
      throw new Error('file header not initialized');
    }
    const id = this.header.rootPageId;
    if (id === 0) {
      return [0, null];
    }
    return [id, this.readPageById(id)];
  }

  /**
   * This will write to disk to update header
   * @param id
   * @param buf
   */
  public setRootPage(id: number, buf: Buffer) {
    this.header!.rootPageId = id;
    this.saveHeaderToFile();
  }

  public readPageById(id: number): Buffer {
    const buf = Buffer.alloc(PAGE_SIZE);
    fs.readSync(this.fd, buf, 0, PAGE_SIZE, Pager.getPageOffsetById(id));
    return buf;
  }

  public writePageById(id: number, buf: Buffer) {
    fs.writeSync(this.fd, buf, 0, PAGE_SIZE, Pager.getPageOffsetById(id));
  }
}
