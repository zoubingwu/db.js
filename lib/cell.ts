export const enum CellType {
  Pointer,
  KeyValue,
}

/**
 * 0                4               8            +key_size
 * +----------------+---------------+-------------+
 * | [int] key_size | [int] page_id | [bytes] key |
 * +----------------+---------------+-------------+
 */
export class PointerCell {
  static calcSize(keySize: number) {
    return 8 + keySize;
  }

  static create(key: Buffer, childPageId: number, offset: number): PointerCell {
    const buf = Buffer.alloc(8);
    buf.writeInt32BE(key.length, 0);
    buf.writeInt32BE(childPageId, 4);
    return new PointerCell(
      Buffer.concat([buf, key], buf.length + key.length),
      offset
    );
  }

  public readonly type = CellType.Pointer;

  public get keySize(): number {
    return this.buffer.readInt32BE(0); // 4 bytes
  }

  public get key(): Buffer {
    return this.buffer.slice(8, 8 + this.keySize);
  }

  public get childPageId(): number {
    return this.buffer.readInt32BE(4); // 4 bytes
  }

  public get size(): number {
    return this.buffer.length;
  }

  public readonly buffer: Buffer;
  public readonly offset: number;

  constructor(rawBuffer: Buffer, offset: number) {
    this.buffer = rawBuffer;
    this.offset = offset;
  }
}

/**
 * 0              1                5                  9           +key_size        +value_size
 * +--------------+----------------+------------------+-------------+----------------+
 * | [byte] flags | [int] key_size | [int] value_size | [bytes] key | [bytes] value  |
 * +--------------+----------------+------------------+-------------+----------------+
 */
export class KeyValueCell {
  static calcSize(keySize: number, valueSize: number) {
    return 9 + keySize + valueSize;
  }

  static create(key: Buffer, value: Buffer, offset: number): KeyValueCell {
    const buf = Buffer.alloc(9);
    buf.writeInt32BE(key.length, 1);
    buf.writeInt32BE(value.length, 5);
    return new KeyValueCell(
      Buffer.concat([buf, key, value], buf.length + key.length + value.length),
      offset
    );
  }

  public readonly type = CellType.KeyValue;

  public get keySize(): number {
    return this.buffer.readInt32BE(1); // 4 bytes
  }

  public get valueSize(): number {
    return this.buffer.readInt32BE(5); // 4 bytes
  }

  public get key(): Buffer {
    return this.buffer.slice(9, 9 + this.keySize);
  }

  public get value(): Buffer {
    return this.buffer.slice(
      9 + this.keySize,
      9 + this.keySize + this.valueSize
    );
  }

  public get size(): number {
    return this.buffer.length;
  }

  public readonly buffer: Buffer;
  public readonly offset: number;

  constructor(rawBuffer: Buffer, offset: number) {
    this.buffer = rawBuffer;
    this.offset = offset;
  }
}