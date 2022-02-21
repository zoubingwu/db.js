import fs from 'fs';
import { afterEach, beforeEach, expect, test, describe } from 'vitest';
import {
  serialize,
  deserialize,
  DataType,
  Database,
  MAGIC_HEADER,
  PAGE_SIZE,
} from '../lib';

test('serialize', () => {
  let buf = serialize(1);
  expect(buf.length).toBe(9);
  expect(buf[0]).toBe(DataType.Number);
  expect(buf.readDoubleBE(1)).toBe(1);

  buf = serialize('a');
  expect(buf.length).toBe(1 + Buffer.from('a').length);
  expect(buf[0]).toBe(DataType.String);
  expect(buf.slice(1).toString()).toBe('a');

  buf = serialize(true);
  expect(buf.length).toBe(2);
  expect(buf[0]).toBe(DataType.Boolean);
  expect(buf[1]).toBe(1);

  buf = serialize(false);
  expect(buf.length).toBe(2);
  expect(buf[0]).toBe(DataType.Boolean);
  expect(buf[1]).toBe(0);
});

test('deserialize', () => {
  let buf = serialize(1);
  expect(deserialize(buf)).toBe(1);

  buf = serialize('a');
  expect(deserialize(buf)).toBe('a');

  buf = serialize(true);
  expect(deserialize(buf)).toBe(true);

  buf = serialize(false);
  expect(deserialize(buf)).toBe(false);
});

describe('Database', () => {
  let db: Database;
  let badFile = './test/fixture/bad.db.snap';
  let file = './test/fixture/good.db';

  const bad = new Database(badFile);
  expect(() => bad.open()).toThrowError('This is not a simple db file!');

  beforeEach(() => {
    db = new Database(file);
  });

  afterEach(() => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  test('get', () => {
    expect(() => db.get('key')).toThrowError('call `db.open` first!');
    db.open();
    expect(db.get('key')).toBe(null);
    db.set('key', 'value');
    expect(db.get('key')).toBe('value');
  });

  test('set', () => {
    expect(() => db.set('key', 'value')).toThrowError('call `db.open` first!');
    db.open();
    expect(db.get('key')).toBe(null);
    db.set('key', 'value');
    expect(db.get('key')).toBe('value');
  });

  test('check file header', () => {
    db.open();
    let buf = Buffer.alloc(100);
    const fd = fs.openSync(file, 'r+');
    fs.readSync(fd, buf, 0, 100, 0);
    expect(buf.slice(0, 19).toString()).toBe(MAGIC_HEADER.toString());
    expect(buf.readInt16BE(19)).toBe(PAGE_SIZE);
    expect(buf.readInt32BE(21)).toBe(0);
    expect(buf.readInt32BE(25)).toBe(0);

    db.set('key', 'value');

    buf = Buffer.alloc(100);
    fs.readSync(fd, buf, 0, 100, 0);
    expect(buf.slice(0, 19).toString()).toBe(MAGIC_HEADER.toString());
    expect(buf.readInt16BE(19)).toBe(PAGE_SIZE);
    expect(buf.readInt32BE(21)).toBe(1);
    expect(buf.readInt32BE(25)).toBe(1);
  });
});
