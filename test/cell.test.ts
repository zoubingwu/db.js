import { expect, test } from 'vitest';
import {
  PointerCell,
  KeyValueCell,
  CellType,
  serialize,
  deserialize,
} from '../lib';

test('PointerCell', () => {
  const cell = PointerCell.create(Buffer.from('a'), 2, 4000);
  expect(cell.type).toBe(CellType.Pointer);
  expect(cell.keySize).toBe(1);
  expect(cell.key.toString()).toBe('a');
  expect(cell.childPageId).toBe(2);
  expect(cell.size).toBe(9);
  expect(cell.offset).toBe(4000);
});

test('KeyValueCell', () => {
  const cell = KeyValueCell.create(Buffer.from('b'), serialize(1), 3000);
  expect(cell.type).toBe(CellType.KeyValue);
  expect(cell.keySize).toBe(1);
  expect(cell.key.toString()).toBe('b');
  expect(cell.valueSize).toBe(9);
  expect(deserialize(cell.value)).toBe(1);
  expect(cell.size).toBe(19);
  expect(cell.offset).toBe(3000);
});
