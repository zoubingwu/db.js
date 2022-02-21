import fs from 'fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  FileHeader,
  Pager,
  FILE_HEADER_SIZE,
  MAGIC_HEADER,
  PAGE_SIZE,
  PageType,
} from '../lib';

describe('Fileheader', () => {
  const header = FileHeader.create();

  test('create', () => {
    expect(header.buffer.length).toBe(FILE_HEADER_SIZE);
    expect(header.buffer.slice(0, 19).toString()).toBe(MAGIC_HEADER.toString());
    expect(header.buffer.readInt16BE(19)).toBe(PAGE_SIZE);
    expect(header.buffer.readInt32BE(21)).toBe(0);
    expect(header.buffer.readInt32BE(25)).toBe(0);
    expect(header.verify()).toBeTruthy();
  });

  test('maxPageId', () => {
    expect(header.buffer.readInt32BE(21)).toBe(0);
    expect(header.maxPageId).toBe(0);
    expect(header.buffer.readInt32BE(21)).toBe(1);
    expect(header.maxPageId).toBe(1);
    expect(header.buffer.readInt32BE(21)).toBe(2);
    expect(header.maxPageId).toBe(2);
    expect(header.buffer.readInt32BE(21)).toBe(3);
  });

  test('rootPageId', () => {
    expect(header.buffer.readInt32BE(25)).toBe(0);
    header.rootPageId = 1;
    expect(header.buffer.readInt32BE(25)).toBe(1);
    expect(header.rootPageId).toBe(1);
  });
});

describe('Pager', () => {
  test('getPageOffsetById', () => {
    expect(Pager.getPageOffsetById(1)).toBe(FILE_HEADER_SIZE);
    expect(Pager.getPageOffsetById(2)).toBe(FILE_HEADER_SIZE + PAGE_SIZE);
    expect(Pager.getPageOffsetById(3)).toBe(FILE_HEADER_SIZE + PAGE_SIZE * 2);
    expect(Pager.getPageOffsetById(4)).toBe(FILE_HEADER_SIZE + PAGE_SIZE * 3);
  });

  let fd: number;
  let pager: Pager;
  let file = './test/fixture/pager.db';

  beforeEach(() => {
    fd = fs.openSync(file, 'w+');
    pager = new Pager(fd);
  });

  afterEach(() => {
    fs.closeSync(fd);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  test('allocNewPage', () => {
    expect(() => pager.allocNewPage()).toThrowError(
      'file header not initialized'
    );
    expect(pager.verifyFileHeader()).toBe(true);
    const [id, buf] = pager.allocNewPage();
    expect(id).toBe(1);
    expect(buf.length).toBe(PAGE_SIZE);
    expect(buf[0]).toBe(PageType.EMPTY);
  });
});
