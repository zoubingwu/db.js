import { Pager } from './pager';
import { Cursor } from './cursor';
import { BTreeNode } from './btreenode';

export class BTree {
  public root: BTreeNode | null = null;
  public readonly pager: Pager;
  public readonly cursor: Cursor;

  private saveNodeToFile(node: BTreeNode) {
    this.pager.writePageById(node.id, node.buffer);
  }

  constructor(pager: Pager, cursor: Cursor) {
    this.pager = pager;
    this.cursor = cursor;
    this.root = this.cursor.getRoot();
  }

  public createRootAndIncreaseHeight(newChildNode: BTreeNode) {
    const [id, buf] = this.pager.allocNewPage();
    const newRoot = new BTreeNode(id, buf);
    newRoot.insertPointerCell(this.root!.lastKey(), this.root!.id);
    newRoot.insertPointerCell(newChildNode.firstKey(), newChildNode.id);
    this.pager.writePageById(id, buf);
    this.pager.setRootPage(id, newRoot.buffer);
  }

  public find(key: Buffer): Buffer | null {
    if (this.root) {
      this.cursor.reset();
      const node = this.cursor.findLeafNodeByKey(this.root, key);
      return node.findKeyValueCell(key)?.value ?? null;
    }
    return null;
  }

  public insert(key: Buffer, value: Buffer) {
    if (!this.root) {
      const [id, buf] = this.pager.allocNewPage();
      this.root = new BTreeNode(id, buf);
      this.pager.setRootPage(id, buf);
    }

    this.cursor.reset();
    let node = this.cursor.findLeafNodeByKey(this.root, key);
    if (node.canHold(key, value)) {
      node.insertKeyValueCell(key, value);
    } else {
      node.splitAndInsert(key, value, this);
    }
    this.saveNodeToFile(node);
  }
}
