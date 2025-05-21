import { describe, it, expect } from 'vitest';
import { Schema, KnownTypeId } from '../src';
import { bytesToHex, hexToBytes } from '../src/utils/bytes';

import demoRollupSchema from '../../__fixtures__/demo-rollup-schema.json';

describe('Schema', () => {
  const schema = Schema.fromJSON(JSON.stringify(demoRollupSchema));
  
  describe('fromJSON', () => {
    it('should give descriptive error on invalid schema', () => {
      expect(() => Schema.fromJSON('{}')).toThrow(/missing field `types`/);
    });
  });
  
  describe('descriptor', () => {
    it('should return the descriptor used to create the schema', () => {
      const expected = JSON.stringify(demoRollupSchema);
      expect(schema.descriptor).toEqual(expected);
    });
  });
  
  describe('chainHash', () => {
    it('should calculate the chain hash successfully', () => {
      expect(schema.chainHash).toBeInstanceOf(Uint8Array);
      expect(schema.chainHash.length).toBe(32);
    });
  });
  
  describe('metadataHash', () => {
    it('should calculate the metadata hash successfully', () => {
      expect(schema.metadataHash).toBeInstanceOf(Uint8Array);
      expect(schema.metadataHash.length).toBe(32);
    });
  });
  
  describe('jsonToBorsh', () => {
    it('should serialize a simple json object to borsh', () => {
      const call = { value_setter: { set_many_values: [4, 6] } };
      const serialized = schema.jsonToBorsh(
        schema.knownTypeIndex(KnownTypeId.RuntimeCall),
        JSON.stringify(call)
      );
      expect(serialized).toBeInstanceOf(Uint8Array);
    });
    
    it('should throw an error for invalid JSON', () => {
      expect(() => 
        schema.jsonToBorsh(
          schema.knownTypeIndex(KnownTypeId.RuntimeCall),
          'invalid json'
        )
      ).toThrow();
    });
  });
  
  describe('knownTypeIndex', () => {
    it('should return the index of a known type', () => {
      expect(() => schema.knownTypeIndex(KnownTypeId.RuntimeCall)).not.toThrow();
    });
    
    it('should throw an error for an unknown type', () => {
    });
  });
});
