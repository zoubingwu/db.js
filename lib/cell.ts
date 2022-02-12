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
  public readonly type = CellType.Pointer;
  public readonly keySize: number;
  public readonly key: Buffer;
  public readonly childPageId: number;
  public readonly size: number;

  public readonly buffer: Buffer;

  constructor(rawBuffer: Buffer) {
    this.buffer = rawBuffer;
    this.keySize = rawBuffer.readInt32BE(0);
    this.childPageId = rawBuffer.readInt32BE(4);
    this.key = rawBuffer.slice(8, 8 + this.keySize);
    this.size = rawBuffer.length;
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

  static create(key: Buffer, value: Buffer): KeyValueCell {
    const buf = Buffer.alloc(9);
    buf.writeInt32BE(key.length, 1);
    buf.writeInt32BE(value.length, 5);
    return new KeyValueCell(
      Buffer.concat([buf, key, value], buf.length + key.length + value.length)
    );
  }

  public readonly type = CellType.KeyValue;
  public readonly keySize: number; // 2 bytes
  public readonly key: Buffer;
  public readonly valueSize: number;
  public readonly value: Buffer;
  public readonly size: number;

  public readonly buffer: Buffer;

  constructor(rawBuffer: Buffer) {
    this.buffer = rawBuffer;
    this.keySize = rawBuffer.readInt32BE(1);
    this.valueSize = rawBuffer.readInt32BE(5);
    this.key = rawBuffer.slice(9, 9 + this.keySize);
    this.value = rawBuffer.slice(
      9 + this.keySize,
      9 + this.keySize + this.valueSize
    );
    this.size = rawBuffer.length;
  }
}
