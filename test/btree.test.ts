import fs from 'fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  BTree,
  Cursor,
  Pager,
  serialize,
  deserialize,
  PointerCell,
  KeyValueCell,
} from '../lib';

describe('BTree', () => {
  let file = './test/fixture/btree.db';
  let fd: number;
  let pager: Pager;
  let cursor: Cursor;
  let btree: BTree;

  beforeEach(() => {
    fd = fs.openSync(file, 'w+');
    pager = new Pager(fd);
    pager.verifyFileHeader();

    cursor = new Cursor(pager);
    btree = new BTree(pager, cursor);
  });

  afterEach(() => {
    fs.closeSync(fd);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  test('insert item', () => {
    btree.insert(Buffer.from('c'), serialize(3));
    btree.insert(Buffer.from('d'), serialize(4));
    btree.insert(Buffer.from('a'), serialize(1));
    btree.insert(Buffer.from('b'), serialize(2));

    expect(btree.root).toBeTruthy();
    expect(btree.root?.id).toBe(1);
    expect(btree.root?.keyCount()).toBe(4);
    expect(btree.root?.keyAt(0)?.toString()).toBe('a');
    expect(btree.root?.keyAt(1)?.toString()).toBe('b');
    expect(btree.root?.keyAt(2)?.toString()).toBe('c');
    expect(btree.root?.keyAt(3)?.toString()).toBe('d');

    expect(btree.find(Buffer.from('a'))).toBeTruthy();
    expect(deserialize(btree.find(Buffer.from('a'))!)).toBe(1);
    expect(btree.find(Buffer.from('b'))).toBeTruthy();
    expect(deserialize(btree.find(Buffer.from('b'))!)).toBe(2);
    expect(btree.find(Buffer.from('c'))).toBeTruthy();
    expect(deserialize(btree.find(Buffer.from('c'))!)).toBe(3);
    expect(btree.find(Buffer.from('d'))).toBeTruthy();
    expect(deserialize(btree.find(Buffer.from('d'))!)).toBe(4);
  });

  test.only('page split', () => {
    btree.insert(Buffer.from('a'), Buffer.from('1'.repeat(2000)));
    btree.insert(Buffer.from('b'), Buffer.from('2'.repeat(2000)));
    expect(btree.root).toBeTruthy();
    expect(btree.root?.id).toBe(1);
    expect(btree.root?.isLeafNode()).toBe(true);

    //@ts-ignore
    const c1 = btree.root?.readCellByIndex(0) as KeyValueCell;
    expect(c1.key.toString()).toBe('a');
    expect(c1.value.toString()).toBe('1'.repeat(2000));

    //@ts-ignore
    const c2 = btree.root?.readCellByIndex(1) as KeyValueCell;
    expect(c2.key.toString()).toBe('b');
    expect(c2.value.toString()).toBe('2'.repeat(2000));

    btree.insert(Buffer.from('c'), Buffer.from('3'.repeat(2000)));
    expect(btree.root?.id).toBe(3);
    expect(btree.root?.keyCount()).toBe(2);
    expect(
      btree.find(Buffer.from('c'))?.compare(Buffer.from('3'.repeat(2000)))
    ).toBe(0);

    btree.insert(Buffer.from('d'), Buffer.from('4'.repeat(2000)));
    expect(btree.root?.id).toBe(3);
    expect(btree.root?.keyCount()).toBe(3);

    //@ts-ignore
    const c3 = btree.root?.readCellByIndex(0) as PointerCell;
    expect(c3.key.toString()).toBe('a');
    expect(c3.childPageId).toBe(1);

    //@ts-ignore
    const c4 = btree.root?.readCellByIndex(1) as PointerCell;
    expect(c4.key.toString()).toBe('b');
    expect(c4.childPageId).toBe(2);

    expect(
      btree.find(Buffer.from('a'))?.compare(Buffer.from('1'.repeat(2000)))
    ).toBe(0);
    expect(
      btree.find(Buffer.from('b'))?.compare(Buffer.from('2'.repeat(2000)))
    ).toBe(0);
    expect(
      btree.find(Buffer.from('c'))?.compare(Buffer.from('3'.repeat(2000)))
    ).toBe(0);
    expect(
      btree.find(Buffer.from('d'))?.compare(Buffer.from('4'.repeat(2000)))
    ).toBe(0);
  });
});
