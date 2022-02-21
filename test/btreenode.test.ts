import { beforeEach, describe, expect, test } from 'vitest';
import {
  serialize,
  PAGE_SIZE,
  BTreeNode,
  KeyValueCell,
  binaryFindFirstGreatorElement,
} from '../lib';

describe('BTreeNode', () => {
  let node: BTreeNode;

  beforeEach(() => {
    const buf = Buffer.alloc(PAGE_SIZE);
    const header = BTreeNode.createEmptyHeader();
    header.copy(buf);
    node = new BTreeNode(1, buf);
  });

  test('BTreeNode.isEqualKey', () => {
    expect(
      BTreeNode.isEqualKey(Buffer.from('a'), Buffer.from('a'))
    ).toBeTruthy();
    expect(
      BTreeNode.isEqualKey(Buffer.from('a'), Buffer.from('b'))
    ).toBeFalsy();
  });

  test('BTreeNode.createEmptyHeader', () => {
    const header = BTreeNode.createEmptyHeader();
    expect(header.length).toBe(8);
    expect(header.readInt8(0)).toBe(0);
    expect(header.readInt16BE(1)).toBe(8);
    expect(header.readInt16BE(3)).toBe(PAGE_SIZE);
  });

  test('node.insertKeyValueCell single cells', () => {
    const key = Buffer.from('a');
    const value = serialize(1);
    const size = KeyValueCell.calcSize(key.length, value.length);

    node.insertKeyValueCell(key, value);

    expect(Buffer.compare(node.firstKey(), key)).toBe(0);
    expect(node.isEmptyNode()).toBeFalsy();
    expect(node.isInternalNode()).toBeFalsy();
    expect(node.isLeafNode()).toBeTruthy();
    expect(node.buffer.readInt16BE(1)).toBe(10);
    expect(node.buffer.readInt16BE(3)).toBe(4096 - size);
    expect(node.keyAt(0)?.toString()).toBe('a');
    expect(node.firstKey().toString()).toBe('a');
    expect(node.lastKey().toString()).toBe('a');
    expect(node.keyCount()).toBe(1);
  });

  test('node.insertKeyValueCell multiple cells', () => {
    const [
      [key1, value1],
      [key2, value2],
      [key3, value3],
      [key4, value4],
      [key5, value5],
    ] = 'edbac'.split('').map(c => [Buffer.from(c), serialize(1)]);

    const size = KeyValueCell.calcSize(key1.length, value1.length);

    node.insertKeyValueCell(key1, value1);
    node.insertKeyValueCell(key2, value2);
    node.insertKeyValueCell(key3, value3);
    node.insertKeyValueCell(key4, value4);
    node.insertKeyValueCell(key5, value5);

    expect(node.isEmptyNode()).toBeFalsy();
    expect(node.isInternalNode()).toBeFalsy();
    expect(node.isLeafNode()).toBeTruthy();
    expect(node.buffer.readInt16BE(1)).toBe(18);
    expect(node.buffer.readInt16BE(3)).toBe(4096 - size * 5);
    expect(node.keyCount()).toBe(5);
    expect(
      node
        .keys()
        .map(i => i.toString())
        .join('')
    ).toBe('abcde');
    expect(node.keyAt(0)?.toString()).toBe('a');
    expect(node.keyAt(1)?.toString()).toBe('b');
    expect(node.keyAt(2)?.toString()).toBe('c');
    expect(node.keyAt(3)?.toString()).toBe('d');
    expect(node.keyAt(4)?.toString()).toBe('e');
  });
});

test('binaryFindFirstGreatorElement', () => {
  let arr = [1, 2, 3, 4, 5, 6, 7, 8];
  let i;
  let comparator = (a: number, b: number) => a - b;

  i = binaryFindFirstGreatorElement(arr, 3, comparator);
  expect(i).toBe(3);
  expect(arr[i]).toBe(4);

  i = binaryFindFirstGreatorElement(arr, 10, comparator);
  expect(i).toBe(-1);
  expect(arr[i]).toBeUndefined();

  i = binaryFindFirstGreatorElement(arr, 0, comparator);
  expect(i).toBe(0);
  expect(arr[i]).toBe(1);

  arr = [];
  i = binaryFindFirstGreatorElement(arr, 3, comparator);
  expect(i).toBe(-1);

  arr = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  i = binaryFindFirstGreatorElement(arr, 1, comparator);
  expect(i).toBe(-1);

  arr = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  i = binaryFindFirstGreatorElement(arr, 2, comparator);
  expect(i).toBe(-1);

  arr = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  i = binaryFindFirstGreatorElement(arr, 0, comparator);
  expect(i).toBe(0);
});
