import { serialize, deserialize } from 'borsh';
import * as shajs from 'sha.js';
import { KnownTypeId, RollupRoots, ChainData, Primitive, ByteDisplay } from './types';
import { MerkleTree } from './utils/merkle-tree';
import { parseBytes, formatBytes } from './utils/bytes';

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaError';
  }
}

export class Schema {
  private jsonDescriptor: string;
  private types: any[] = [];
  private rootTypeIndices: number[] = [];
  private chainData: ChainData;
  private merkleTree?: MerkleTree;
  private _metadataHash?: Uint8Array;
  private _chainHash?: Uint8Array;
  private extraMetadataHash: Uint8Array = new Uint8Array(32);
  private templates: any[] = [];
  private serdeMetadata: any[] = [];

  private constructor(jsonDescriptor: string) {
    this.jsonDescriptor = jsonDescriptor;
    this.chainData = { chain_id: '', chain_name: '' };
  }

  /**
   * Creates a Schema instance from the provided JSON descriptor.
   */
  static fromJSON(json: string): Schema {
    try {
      const parsed = JSON.parse(json);
      
      if (!parsed.types || !Array.isArray(parsed.types)) {
        throw new SchemaError('Invalid schema: missing field `types`');
      }
      
      const schema = new Schema(json);
      
      schema.types = parsed.types;
      schema.rootTypeIndices = parsed.root_type_indices || [];
      schema.chainData = parsed.chain_data || { chain_id: '', chain_name: '' };
      schema.extraMetadataHash = parsed.extra_metadata_hash || new Uint8Array(32);
      schema.templates = parsed.templates || [];
      schema.serdeMetadata = parsed.serde_metadata || [];
      
      return schema;
    } catch (e) {
      if (e instanceof SchemaError) {
        throw e;
      }
      throw new SchemaError(`Failed to parse schema: ${e}`);
    }
  }

  /**
   * Returns the JSON descriptor that was used to create this schema instance.
   */
  get descriptor(): string {
    return this.jsonDescriptor;
  }

  /**
   * Converts the provided JSON to borsh according to the provided schema.
   */
  jsonToBorsh(typeIndex: number, input: string): Uint8Array {
    try {
      const parsedInput = JSON.parse(input);
      const typeDefinition = this.types[typeIndex];
      
      if (!typeDefinition) {
        throw new SchemaError(`Type index ${typeIndex} not found in schema`);
      }
      
      const writer = new Uint8Array(1024); // Initial size, will grow as needed
      let offset = 0;
      
      offset = this.serializeValue(writer, offset, parsedInput, typeDefinition);
      
      return writer.slice(0, offset);
    } catch (e) {
      throw new SchemaError(`Failed to convert JSON to Borsh: ${e}`);
    }
  }

  /**
   * Displays the provided borsh bytes as a string according to the provided schema.
   */
  display(typeIndex: number, input: Uint8Array): string {
    try {
      const typeDefinition = this.types[typeIndex];
      
      if (!typeDefinition) {
        throw new SchemaError(`Type index ${typeIndex} not found in schema`);
      }
      
      const value = this.deserializeValue(input, 0, typeDefinition);
      
      return JSON.stringify(value, null, 2);
    } catch (e) {
      throw new SchemaError(`Failed to display Borsh bytes: ${e}`);
    }
  }

  /**
   * Get the index of the provided known type within the schema.
   */
  knownTypeIndex(knownTypeId: KnownTypeId): number {
    const rollupRoot = this.getRollupRoot(knownTypeId);
    
    const index = this.rootTypeIndices[rollupRoot];
    
    if (index === undefined) {
      throw new SchemaError(`Known type id ${knownTypeId} not found in schema`);
    }
    
    return index;
  }
  
  private getRollupRoot(knownTypeId: KnownTypeId): RollupRoots {
    switch (knownTypeId) {
      case KnownTypeId.Transaction:
        return RollupRoots.Transaction;
      case KnownTypeId.UnsignedTransaction:
        return RollupRoots.UnsignedTransaction;
      case KnownTypeId.RuntimeCall:
        return RollupRoots.RuntimeCall;
      default:
        throw new SchemaError(`Unknown KnownTypeId: ${knownTypeId}`);
    }
  }

  /**
   * Get the metadata hash from the schema.
   */
  get metadataHash(): Uint8Array {
    if (!this._metadataHash) {
      const hasher = new shajs.sha256();
      
      hasher.update(JSON.stringify(this.templates));
      hasher.update(JSON.stringify(this.serdeMetadata));
      
      this._metadataHash = new Uint8Array(hasher.digest());
    }
    
    return this._metadataHash;
  }

  /**
   * Get the chain hash from the schema.
   */
  get chainHash(): Uint8Array {
    if (!this._chainHash) {
      if (!this.merkleTree) {
        this.merkleTree = new MerkleTree();
        
        for (const type of this.types) {
          const serialized = new TextEncoder().encode(JSON.stringify(type));
          this.merkleTree.pushRawLeaf(serialized);
        }
      }
      
      const merkleRoot = this.merkleTree.root();
      
      const hasher = new shajs.sha256();
      hasher.update(JSON.stringify(this.rootTypeIndices));
      hasher.update(JSON.stringify(this.chainData));
      const internalDataHash = new Uint8Array(hasher.digest());
      
      const finalHasher = new shajs.sha256();
      finalHasher.update(merkleRoot);
      finalHasher.update(internalDataHash);
      finalHasher.update(this.extraMetadataHash);
      
      this._chainHash = new Uint8Array(finalHasher.digest());
    }
    
    return this._chainHash;
  }

  
  private serializeValue(buffer: Uint8Array, offset: number, value: any, typeDefinition: any): number {
    
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(value));
    
    const view = new DataView(buffer.buffer);
    view.setUint32(offset, encoded.length, true);
    offset += 4;
    
    buffer.set(encoded, offset);
    offset += encoded.length;
    
    return offset;
  }
  
  private deserializeValue(buffer: Uint8Array, offset: number, typeDefinition: any): any {
    
    const view = new DataView(buffer.buffer);
    const length = view.getUint32(offset, true);
    offset += 4;
    
    const decoder = new TextDecoder();
    const json = decoder.decode(buffer.slice(offset, offset + length));
    
    return JSON.parse(json);
  }
}
