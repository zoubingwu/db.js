import { beforeEach, expect, test } from 'vitest';
import {
  serialize,
  PAGE_SIZE,
  BTreeNode,
  KeyValueCell,
  PageType,
} from '../lib';

test('BTreeNode.isEqualKey', () => {
  expect(BTreeNode.isEqualKey(Buffer.from('a'), Buffer.from('a'))).toBeTruthy();
  expect(BTreeNode.isEqualKey(Buffer.from('a'), Buffer.from('b'))).toBeFalsy();
});

test('BTreeNode.createEmptyHeader', () => {
  const header = BTreeNode.createEmptyHeader();
  console.log('header: ', header);
  expect(header.length).toBe(8);
  expect(header.readInt8(0)).toBe(0);
  expect(header.readInt16BE(1)).toBe(8);
  expect(header.readInt16BE(3)).toBe(PAGE_SIZE);
});

let node: BTreeNode;

beforeEach(() => {
  const buf = Buffer.alloc(PAGE_SIZE);
  const header = BTreeNode.createEmptyHeader();
  header.copy(buf);
  node = new BTreeNode(1, buf);
});

test('node.insertKeyValueCell', () => {
  const key = Buffer.from('a');
  const value = serialize(1);
  const size = KeyValueCell.calcSize(key.length, value.length);

  node.insertKeyValueCell(key, value);

  expect(Buffer.compare(node.firstKey(), key)).toBe(0);
  expect(node.pageType).toBe(PageType.LEAF);
  expect(node.isEmptyNode()).toBeFalsy();
  expect(node.isInternalNode()).toBeFalsy();
  expect(node.isLeafNode()).toBeTruthy();
  expect(node.freeStart).toBe(10);
  expect(node.cellAreaStart).toBe(4096 - size);
  expect(node.cellOffsets).toStrictEqual([4096 - size]);
});
