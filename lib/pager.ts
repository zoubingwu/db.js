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
export class Pager {
  static getPageOffsetById(id: number) {
    return (id - 1) * PAGE_SIZE + FILE_HEADER_SIZE;
  }

  private readonly fd: number;
  private readonly header: Buffer;

  private createFileHeader(): Buffer {
    const header = Buffer.alloc(FILE_HEADER_SIZE);
    MAGIC_HEADER.copy(header); // magic header 19 bytes
    header.writeInt16BE(PAGE_SIZE, MAGIC_HEADER_SIZE); // page size 2 bytes
    header.writeInt32BE(0, MAGIC_HEADER_SIZE + 2); // max page id 4 bytes
    return header;
  }

  private getMaxPageId() {
    const curr = this.header.readInt32BE(MAGIC_HEADER_SIZE + 2);
    this.header.writeInt32BE(curr + 1, MAGIC_HEADER_SIZE + 2);
    return curr;
  }

  constructor(fd: number) {
    this.fd = fd;
    const header = Buffer.alloc(FILE_HEADER_SIZE);
    fs.readSync(this.fd, header, 0, FILE_HEADER_SIZE, 0);
    this.header = header;

    const isEmpty = fs.fstatSync(this.fd).size === 0;
    if (isEmpty) {
      this.header = this.createFileHeader();
      this.writeFileHeader();
    }
  }

  public allocNewPage(): [number, Buffer] {
    const buf = Buffer.alloc(PAGE_SIZE);
    const header = BTreeNode.createEmptyHeader();
    header.copy(buf);
    const id = this.getMaxPageId() + 1;
    this.writeFileHeader();
    this.writePageNodeById(id, buf);
    return [id, buf];
  }

  public verifyFileHeader(): boolean {
    return this.header.slice(0, MAGIC_HEADER_SIZE).compare(MAGIC_HEADER) === 0;
  }

  public writeFileHeader() {
    fs.writeSync(this.fd, this.header, 0, FILE_HEADER_SIZE, 0);
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
