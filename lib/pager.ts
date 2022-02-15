import fs from 'fs';

import { BTreeNode } from './btree';
import {
  PAGE_SIZE,
  FILE_HEADER_SIZE,
  MAGIC_HEADER,
  MAGIC_HEADER_SIZE,
} from './constant';

/**
 * file header, FIXED 100 bytes:
 *
 * 0                     19          21            23            100
 * +---------------------+-----------+-------------+--------------+
 * | magic_header_string | page_size | max_page_id | unused_space |
 * +---------------------+-----------+-------------+--------------+
 */
class FileHeader {
  public static create(): FileHeader {
    const header = Buffer.alloc(FILE_HEADER_SIZE);
    MAGIC_HEADER.copy(header); // magic header 19 bytes
    header.writeInt16BE(PAGE_SIZE, MAGIC_HEADER_SIZE); // page size 2 bytes
    header.writeInt32BE(0, MAGIC_HEADER_SIZE + 2); // max page id 4 bytes
    return new FileHeader(header);
  }

  private readonly buffer: Buffer;

  constructor(buf: Buffer) {
    this.buffer = buf;
  }

  public get maxPageId(): number {
    const curr = this.buffer.readInt32BE(MAGIC_HEADER_SIZE + 2);
    this.buffer.writeInt32BE(curr + 1, MAGIC_HEADER_SIZE + 2);
    return curr;
  }

  public verify(): boolean {
    return this.buffer.slice(0, MAGIC_HEADER_SIZE).compare(MAGIC_HEADER) === 0;
  }

  public saveToFile(fd: number) {
    fs.writeSync(fd, this.buffer, 0, FILE_HEADER_SIZE, 0);
  }
}

export class Pager {
  static getPageOffsetById(id: number) {
    return (id - 1) * PAGE_SIZE + FILE_HEADER_SIZE;
  }

  private readonly fd: number;
  private header: FileHeader | null = null;

  constructor(fd: number) {
    this.fd = fd;
  }

  /**
   * alloc an empty page and will increase max page id in header
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
    this.header.saveToFile(this.fd);
    this.writePageById(id, buf);
    return [id, buf];
  }

  public verifyFileHeader(): boolean {
    const isEmpty = fs.fstatSync(this.fd).size === 0;
    if (isEmpty) {
      this.header = FileHeader.create();
      this.header.saveToFile(this.fd);
    } else {
      const header = Buffer.alloc(FILE_HEADER_SIZE);
      fs.readSync(this.fd, header, 0, FILE_HEADER_SIZE, 0);
      this.header = new FileHeader(header);
    }
    return this.header.verify();
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
