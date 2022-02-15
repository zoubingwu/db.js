import { BTreeNode } from './btree';
import { Pager } from './pager';

export class Cursor {
  private breadcrumbs: number[] = [];
  private readonly pager: Pager;
  private root?: BTreeNode;

  constructor(pager: Pager) {
    this.pager = pager;
  }

  public reset() {
    this.breadcrumbs = [];
  }

  public getRoot(): BTreeNode {
    if (this.root) {
      return this.root;
    }
    const buf = this.pager.readPageById(1);
    return new BTreeNode(1, buf);
  }

  public findLeafNodeByKey(
    startNode: BTreeNode,
    key: Buffer
  ): BTreeNode | null {
    this.breadcrumbs.push(startNode.id);
    let nodeOrPointer = startNode.findSubnode(key);

    while (typeof nodeOrPointer === 'number') {
      const buf = this.pager.readPageById(nodeOrPointer);
      startNode = new BTreeNode(nodeOrPointer, buf, startNode.id);
      this.breadcrumbs.push(startNode.id);
      nodeOrPointer = startNode.findSubnode(key);
    }

    return nodeOrPointer;
  }
}
