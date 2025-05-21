import * as shajs from 'sha.js';

export class MerkleTree {
  private leaves: Uint8Array[] = [];
  
  constructor() {}
  
  pushRawLeaf(data: Uint8Array): void {
    this.leaves.push(data);
  }
  
  root(): Uint8Array {
    if (this.leaves.length === 0) {
      return new Uint8Array(32); // Empty hash (all zeros)
    }
    
    const hasher = shajs('sha256');
    
    for (const leaf of this.leaves) {
      hasher.update(leaf);
    }
    
    return new Uint8Array(hasher.digest());
  }
}
