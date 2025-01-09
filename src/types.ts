import { Jwk, LocalKeyManager } from '@web5/crypto';
import { DidCreateOptions, DidCreateVerificationMethod, DidDocument, DidService } from '@web5/dids';

export enum DidBtc1RegisteredKeyType {
    /**
     * secp256k1: A cryptographic curve used for digital signatures in a range of decentralized
     * systems.
     */
    secp256k1 = 1,
}

export enum DidBtc1Network {
    mainnet = 'mainnet',
    testnet = 'testnet',
    signet = 'signet',
    regtest = 'regtest',
}
export interface DidBtc1ServiceSingletonBeacon extends DidService {
    id: '#singletonBeacon';
    type: 'SingletonBeacon';
    serviceEndpoint: string;
}
/**
 * Options for creating a Decentralized Identifier (DID) using the DID BTC1 method.
 */
export interface DidBtc1CreateOptions<TKms> extends DidCreateOptions<TKms> {
    /** DID BTC1 Version Number */
    version?: number;
    /** Bitcoin Network */
    network?: 'mainnet' | 'testnet' | 'signet' | 'regtest';
    /** DID BTC1 Creation Type: deterministic or sidecar */
    type?: string;
    /** optional secp256k1 public key; required if type = 'deterministic' */
    publicKey?: Uint8Array;
    /** optional Jwk; required during method specific creation (deterministic or sidecar) */
    jwk?: Jwk;
    /**
     * Optional. An array of service endpoints associated with the DID.
     *
     * Services are used in DID documents to express ways of communicating with the DID subject or
     * associated entities. A service can be any type of service the DID subject wants to advertise,
     * including decentralized identity management services for further discovery, authentication,
     * authorization, or interaction.
     * 
     * @default [DidBtc1ServiceSingletonBeacon]; @see {@link DidBtc1ServiceSingletonBeacon}
     *
     * @see {@link https://www.w3.org/TR/did-core/#services | DID Core Specification, § Services}
     *
     * @example
     * ```ts
     * const did = await DidBtc1.create({
     *  options: {
     *   services: [
     *     {
     *       id: '#singletonBeacon',
     *       type: 'SingletonBeacon',
     *       serviceEndpoint: 'bitcoin:bech32_secp_pubkey',
     *     }
     *   ]
     * };
     * ```
     */
    services?: DidService[];

    /**
     * Optional. An array of verification methods to be included in the DID document.
     *
     * By default, a newly created DID BTC1 document will contain a single verification method.
     *
     * @see {@link https://www.w3.org/TR/did-core/#verification-methods | DID Core Specification, § Verification Methods}
     *
     * @example
     * ```ts
     * const did = await DidBtc1.create({
     *  options: {
     *     {
     *       id: '#initialKey',
     *       type: 'JsonWebKey',
     *     }
     *   ]
     * };
     * ```
     */
    verificationMethods?: DidCreateVerificationMethod<TKms>[];
}

export type DidBtc1CreateResponse = {
    did: string;
    didDocument: DidDocument;
    mnemonic?: string;
};

export type IntermediateDidDocument = Omit<DidDocument, 'id' | 'verificationMethod'>;