export const DEFAULT_DB_FILE = './data.db';
export const MAGIC_HEADER = Buffer.from('my simpledb format\x00');
export const MAGIC_HEADER_SIZE = MAGIC_HEADER.length; // 19
export const FILE_HEADER_SIZE = 100;
export const PAGE_SIZE = 4096;
