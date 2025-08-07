
import * as ed25519 from "@noble/ed25519";
import { describe, expect, it } from "vitest";
import { TurnkeySigner, TurnkeyConfig } from "./turnkey-signer";
import { keccak_256 } from "@noble/hashes/sha3";
import * as secp256k1 from "@noble/secp256k1";
import { Ed25519Signer } from "./ed25519";
import { TurnkeyClient } from "@turnkey/http";
import { Secp256k1Signer } from "./secp256k1";
import { Point } from "@noble/secp256k1";

// Mock TurnkeyClient for testing
const createMockTurnkeyClient = (curve: "CURVE_ED25519" | "CURVE_SECP256K1", testSigner: any) => {
	let lastParameters: any = null;
	
	return {
		getPrivateKey: async () => {
			const publicKeyHex = curve === "CURVE_ED25519" 
				? Buffer.from(await testSigner.publicKey()).toString('hex')
				: Point.fromPrivateKey(testSigner.privateKeyBytes).toHex(false); // uncompressed for secp256k1
			
			return {
				privateKey: {
					curve,
					publicKey: publicKeyHex
				}
			};
		},
		signRawPayload: async ({ parameters }: any) => {
			lastParameters = parameters;
			return {
				activity: {
					id: "mock-activity-id"
				}
			};
		},
		getActivity: async () => {
			if (!lastParameters) {
				throw new Error("No parameters found from signRawPayload");
			}
			
			const message = lastParameters.encoding === "PAYLOAD_ENCODING_HEXADECIMAL" 
				? Buffer.from(lastParameters.payload, 'hex')
				: new Uint8Array();
			
			let signature: Uint8Array;
			if (curve === "CURVE_ED25519") {
				// For ed25519, TurnkeySigner sends the raw message
				signature = await testSigner.sign(message);
			} else {
				// For secp256k1, TurnkeySigner already hashed the message before sending
				// We need to sign the hash directly without re-hashing
				const sig = await secp256k1.signAsync(message, testSigner.privateKeyBytes);
				signature = sig.toCompactRawBytes();
			}
			
			if (curve === "CURVE_ED25519") {
				return {
					activity: {
						status: "ACTIVITY_STATUS_COMPLETED",
						result: {
							signRawPayloadResult: {
								r: Buffer.from(signature.slice(0, 32)).toString('hex'),
								s: Buffer.from(signature.slice(32, 64)).toString('hex')
							}
						}
					}
				};
			} else {
				// secp256k1 signature parsing
				const sig = secp256k1.Signature.fromCompact(signature);
				return {
					activity: {
						status: "ACTIVITY_STATUS_COMPLETED",
						result: {
							signRawPayloadResult: {
								r: sig.r.toString(16).padStart(64, '0'),
								s: sig.s.toString(16).padStart(64, '0')
							}
						}
					}
				};
			}
		}
	} as any;
};

describe("TurnkeySigner - Ed25519", async () => {
	const testPrivateKeyBytes = new Uint8Array(32).fill(1);
	const testMessage = new Uint8Array([4, 5, 6]);
	const vanillaSigner = new Ed25519Signer(testPrivateKeyBytes);
	const publickey = await vanillaSigner.publicKey();

	const ORG_ID = `mock-org`;
	const mockClient = createMockTurnkeyClient("CURVE_ED25519", vanillaSigner);
	const signer = new TurnkeySigner(publickey, mockClient, {
		organizationId: ORG_ID,
		apiPublicKey: "foo",
		apiPrivateKey: "bar",
		keyId: "baz",
	}, "ed25519");

	it("should sign a message and verify the signature", async () => {
		
		const signature = await signer.sign(testMessage);
		const publicKey = await signer.publicKey();
		const isValid = await ed25519.verifyAsync(
			signature,
			testMessage,
			publicKey,
		);
		expect(isValid).toBe(true);
	}, 100000);
	it("should fail verification with tampered message", async () => {
		const signature = await signer.sign(testMessage);
		const publicKey = await signer.publicKey();
		const tamperedMessage = new Uint8Array([...testMessage, 7]); // Tamper by adding extra byte
		const isValid = await ed25519.verifyAsync(
		  signature,
		  tamperedMessage,
		  publicKey,
		);
		expect(isValid).toBe(false);
	  });
})


describe("TurnkeySigner - Secp256k1", () => {
	const testPrivateKeyBytes = new Uint8Array(32).fill(2);
	const testMessage = new Uint8Array([4, 5, 6]);
	const vanillaSigner = new Secp256k1Signer(testPrivateKeyBytes);
	// Add private key bytes to the signer for the mock to access
	(vanillaSigner as any).privateKeyBytes = testPrivateKeyBytes;
	
	const ORG_ID = `mock-org`;
	const mockClient = createMockTurnkeyClient("CURVE_SECP256K1", vanillaSigner);
	
	// Get compressed public key for TurnkeySigner (matching the behavior in create method)
	const point = Point.fromPrivateKey(testPrivateKeyBytes);
	const compressedPublicKey = point.toRawBytes(true);
	const signer = new TurnkeySigner(compressedPublicKey, mockClient, {
		organizationId: ORG_ID,
		apiPublicKey: "foo",
		apiPrivateKey: "bar",
		keyId: "baz",
	}, "secp256k1");

	it("should sign a message and verify the signature", async () => {
		const signature = await signer.sign(testMessage);
		const publicKey = await signer.publicKey();
		const msgHash = keccak_256(testMessage);
		const sig = secp256k1.Signature.fromCompact(signature);
		const isValid = secp256k1.verify(sig, msgHash, publicKey);
		expect(isValid).toBe(true);
	}, 100000);
	
	it("should fail verification with tampered message", async () => {
		const signature = await signer.sign(testMessage);
		const publicKey = await signer.publicKey();
		const tamperedMessage = new Uint8Array([...testMessage, 7]);
		const msgHash = keccak_256(tamperedMessage);
		const sig = secp256k1.Signature.fromCompact(signature);
		const isValid = secp256k1.verify(sig, msgHash, publicKey);
		expect(isValid).toBe(false);
	});
})
