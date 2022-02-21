import { BTreeNode } from './btreenode';
import { Pager } from './pager';

export class Cursor {
  private breadcrumbs: number[] = [];
  private index: number = -1;
  private readonly pager: Pager;

  private addBreadcrumbs(b: number) {
    this.breadcrumbs.push(b);
    this.index++;
  }

  constructor(pager: Pager) {
    this.pager = pager;
  }

  public reset() {
    this.breadcrumbs = [];
    this.index = -1;
  }

  public getRoot(): BTreeNode | null {
    const [id, buf] = this.pager.readRootPage();
    if (!buf) {
      return null;
    }
    return new BTreeNode(id, buf);
  }

  public findLeafNodeByKey(startNode: BTreeNode, key: Buffer) {
    this.addBreadcrumbs(startNode.id);
    let nodeOrPointer = startNode.findSubtreeOrLeaf(key);

    while (typeof nodeOrPointer === 'number') {
      const buf = this.pager.readPageById(nodeOrPointer);
      startNode = new BTreeNode(nodeOrPointer, buf);
      this.addBreadcrumbs(startNode.id);
      nodeOrPointer = startNode.findSubtreeOrLeaf(key);
    }

    return nodeOrPointer;
  }

  /**
   * This returns a new Node, be careful!
   * @returns [id, buffer]
   */
  public prev() {
    if (this.index === 0) {
      // currently pointing to the root node
      return null;
    }

    const id = this.breadcrumbs.at(this.index - 1);

    if (typeof id === 'undefined') {
      return null;
    } else {
      const buf = this.pager.readPageById(id);
      this.index--;
      return new BTreeNode(id, buf);
    }
  }
}
