import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { ethers } from "ethers"; // v6 helpers
import 'dotenv/config';
import type { Signer } from "@sovereign-sdk/signers";
import { hexToBytes, bytesToHex } from "@sovereign-sdk/utils";
import { Point } from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";

// --- Turnkey Configuration ---
const ORG_ID = process.env.TURNKEY_ORG_ID;
const API_PUBLIC_KEY = process.env.TURNKEY_API_PUB;
const API_PRIVATE_KEY = process.env.TURNKEY_API_PRIV;
// This is the private key that will be used to sign the transaction.
// It is managed by Turnkey and never leaves their environment.
const ECDSA_KEY_ID = process.env.TURNKEY_ECDSA_KEY_ID; // your key ID

if (!ORG_ID || !API_PUBLIC_KEY || !API_PRIVATE_KEY || !ECDSA_KEY_ID) {
    throw new Error("Turnkey environment variables are not set. Please create a .env file.");
}

// Helper function to wait for a certain amount of time.
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export class TurnkeySecp256k1Signer implements Signer {
    private tk: TurnkeyClient;
    public readonly _publicKey: Uint8Array;

    private constructor(
        publicKey: Uint8Array,
        turnkeyClient: TurnkeyClient
    ) {
        this._publicKey = publicKey;
        this.tk = turnkeyClient;

        // Bind `this` to the methods to ensure the context is not lost
        // when they are called by the Sovereign SDK.
        this.sign = this.sign.bind(this);
    }

    public static async create(): Promise<TurnkeySecp256k1Signer> {
        if (!/^[0-9a-fA-F]+$/.test(API_PRIVATE_KEY!)) {
            throw new Error(`Invalid TURNKEY_API_PRIV: not a valid hex string. Please check your .env file.`);
        }
        if (!/^[0-9a-fA-F]+$/.test(API_PUBLIC_KEY!)) {
            throw new Error(`Invalid TURNKEY_API_PUB: not a valid hex string. Please check your .env file.`);
        }

        const stamper = new ApiKeyStamper({
            apiPublicKey: API_PUBLIC_KEY!,
            apiPrivateKey: API_PRIVATE_KEY!,
        });

        const turnkeyClient = new TurnkeyClient({ baseUrl: "https://api.turnkey.com" }, stamper);

        const response = await turnkeyClient.getPrivateKey({
            organizationId: ORG_ID!,
            privateKeyId: ECDSA_KEY_ID!,
        });

        const uncompressedPublicKey = response.privateKey.publicKey;
        if (!uncompressedPublicKey) {
            throw new Error(`Could not retrieve public key for Turnkey key ${ECDSA_KEY_ID}`);
        }
        
        // The public key from Turnkey is uncompressed (prefixed with 0x04, 65 bytes).
        // The Sovereign SDK expects a compressed (33-byte) public key.
        const point   = Point.fromHex(uncompressedPublicKey);
        const compressedPublicKey = point.toRawBytes(true);

        return new TurnkeySecp256k1Signer(compressedPublicKey, turnkeyClient);
    }

    public async publicKey(): Promise<Uint8Array> {
        return this._publicKey;
    }

    async sign(message: Uint8Array): Promise<Uint8Array> {
        const msgHash = bytesToHex(keccak_256(message));

        const response = await this.tk.signRawPayload({
            type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
            organizationId: ORG_ID!,
            timestampMs: String(Date.now()),
            parameters: {
                signWith: ECDSA_KEY_ID!,
                payload: msgHash,
                encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
                hashFunction: "HASH_FUNCTION_NO_OP",
            },
        });

        // Poll every 60s until COMPLETED
        while (true) {
            await wait(60000);
            const { activity } = await this.tk.getActivity({
                organizationId: ORG_ID!,
                activityId: response.activity.id,
            });

            if (activity.status === "ACTIVITY_STATUS_COMPLETED") {
                if (activity.result && activity.result.signRawPayloadResult) {
                    const { r, s } = activity.result.signRawPayloadResult;

                    // The Sovereign SDK expects a 64-byte signature (r || s).
                    // The recovery ID (v) is handled separately by the SDK.
                    const sigBytes = ethers.concat([
                        ethers.getBytes(`0x${r}`),
                        ethers.getBytes(`0x${s}`),
                    ]);

                    return hexToBytes(sigBytes);
                } else {
                    throw new Error(`Turnkey activity completed but missing signature result. Full activity: ${JSON.stringify(activity, null, 2)}`);
                }
            }

            if (activity.status === "ACTIVITY_STATUS_REJECTED" || activity.status === "ACTIVITY_STATUS_FAILED") {
                throw new Error(`Turnkey activity was not completed. Status: ${activity.status}`);
            }

        }
    }
}