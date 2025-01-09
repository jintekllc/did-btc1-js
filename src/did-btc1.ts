import * as secp256k1 from '@noble/secp256k1';
import { base64url, bech32 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Jwk, LocalKeyManager } from '@web5/crypto';
import type {
  DidDocument,
  DidResolutionOptions,
  DidResolutionResult,
  DidVerificationMethod
} from '@web5/dids';
import {
  Did,
  DidError,
  DidErrorCode,
  DidMethod,
  EMPTY_DID_RESOLUTION_RESULT
} from '@web5/dids';
import { initEccLib, networks, payments } from 'bitcoinjs-lib';
import { CID } from 'multiformats/cid';
import * as json from 'multiformats/codecs/json';
import { sha256 } from 'multiformats/hashes/sha2';
import * as ecc from 'tiny-secp256k1';
import {
  DidBtc1CreateOptions,
  DidBtc1CreateResponse,
  DidBtc1Network,
  DidBtc1RegisteredKeyType,
  IntermediateDidDocument
} from './types.js';
import { bigintToBuffer, extractDidFragment } from './utils.js';

initEccLib(ecc);
const AlgorithmToKeyTypeMap = { secp256k1: DidBtc1RegisteredKeyType.secp256k1 } as const;

export class DidBtc1 extends DidMethod {
  /**
   * Name of the DID method, as defined in the DID BTC1 specification.
   */
  public static methodName = 'btc1';

  /**
   *
   * @param params.keyManager - The key manager to use for key operations.
   * @param params.options - Optional parameters for creating the DID; @see {@link DidBtc1CreateOptions}.
   * @returns A Promise resolving to a {@link DidBtc1CreateResponse} object containing the mnemonic
   */

  // TODO: Cleanup create; Generalize for both types. Abstract createDeterministic and createSidecar methods.
  // TODO: Remove LocalKeyManager and separate create options from Tkms
  public static async create({ options = {} }: {
    options?: DidBtc1CreateOptions<LocalKeyManager>;
  } = {}): Promise<DidBtc1CreateResponse> {
    // Validate DID-method-specific requirements to prevent keys from being generated unnecessarily.

    // Check 1: Validate the algorithm as supported by the DID BTC1 specification.
    if (options.verificationMethods?.some(vm => !(vm.algorithm in AlgorithmToKeyTypeMap))) {
      throw new Error('One or more verification method algorithms are not supported');
    }

    // Check 2: Validate that the ID for any given verification method is unique.
    const methodIds = options.verificationMethods?.filter(vm => 'id' in vm).map(vm => vm.id);
    if (methodIds && methodIds.length !== new Set(methodIds).size) {
      throw new Error('One or more verification method IDs are not unique');
    }

    // Check 3: Validate that the required properties for any given services are present.
    if (options.services?.some(s => !s.id || !s.type || !s.serviceEndpoint)) {
      throw new Error('One or more services are missing required properties');
    }

    // Check 4: Validate that the network is one of enum DidBtc1Network.
    if (options.network && !(options.network in DidBtc1Network)) {
      throw new Error(`Invalid network: ${options.network}`);
    }

    // Set the networkName to the default value if not provided.
    options.network = options.network ?? 'mainnet';
    options.version = options.version ?? 1;

    const networkName = options.network;
    // Set the network based on the options above.
    const isMainnet = DidBtc1Network[options.network as keyof typeof DidBtc1Network];
    const network = isMainnet
      ? networks.bitcoin
      : [DidBtc1Network.testnet, DidBtc1Network.signet].includes(networkName as DidBtc1Network)
        ? networks.testnet
        : networks.regtest;

    // Set the coin type of the derivation path based on the network option.
    const derivationPath = `m/44'/${isMainnet ? 0 : 1}'/0'/0/0`;

    // Generate random mnemonic and seed from mnemonic.
    const mnemonic = generateMnemonic(wordlist, 128);
    const seed = await mnemonicToSeed(mnemonic);

    // Generate HDKey from seed.
    const { publicKey, privateKey }: HDKey = HDKey.fromMasterSeed(seed).derive(derivationPath);

    // Ensure HDKey returns valid
    if (!(publicKey && privateKey)) {
      throw new Error('Failed to derive hd keypair');
    }

    // Get x point from hd pubkey.
    const { x, y } = secp256k1.ProjectivePoint.fromHex(publicKey) ?? {};

    // Create JWK from hd pubkey x point, y point and privkey.
    const jwk = {
      kty: 'EC',
      crv: 'secp256k1',
      x: base64url.encode(bigintToBuffer(x)),
      y: base64url.encode(bigintToBuffer(y)),
      d: base64url.encode(Buffer.from(privateKey))
    } as Jwk;

    // Create Intermediate DID Document.
    const interDidDoc: IntermediateDidDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://github.com/dcdpr/did-btc1'
      ],
      authentication: ['#initialKey'],
      assertionMethod: ['#initialKey'],
      capabilityInvocation: ['#initialKey'],
      capabilityDelegation: ['#initialKey'],
      service: [{
        id: '#initial_p2pkh',
        type: 'SingletonBeacon',
        serviceEndpoint: 'bitcoin:' + payments.p2pkh({ pubkey: publicKey, network }).address
      },
      {
        id: '#initial_p2wpkh',
        type: 'SingletonBeacon',
        serviceEndpoint: 'bitcoin:' + payments.p2wpkh({ pubkey: publicKey, network }).address
      },
      {
        id: '#initial_p2tr',
        type: 'SingletonBeacon',
        serviceEndpoint: 'bitcoin:' + payments.p2tr({ internalPubkey: publicKey.slice(1, 33), network }).address
      }]
    };

    // Set the jwk in options.
    options.jwk = jwk;

    // Call createDeterministic or createSidecar based on options.
    if (!!options.type && options.type?.toLowerCase() !== 'deterministic') {
      // Return DID and DID Document.
      return await this.createSidecar({ interDidDoc, options });
    }

    // Set the public key in options.
    options.publicKey = publicKey;

    // Return DID, DID Document and mnemonic.
    return { ...await this.createDeterministic({ interDidDoc, options }), mnemonic };
  }

  public static async createDeterministic({
    interDidDoc,
    options: { version, publicKey, jwk }
  }: {
    interDidDoc: IntermediateDidDocument;
    options: DidBtc1CreateOptions<LocalKeyManager>;
  }): Promise<DidBtc1CreateResponse> {
    // Create DID Method prefix based on version.
    const didMethodPrefix = version !== 1
      ? `did:${this.methodName}:${version}:k1`
      : `did:${this.methodName}`;
    // Bech32 encode the public key with 'k' hrp.
    const methodSpecificId = bech32.encode('k', bech32.toWords(publicKey!));
    // Create DID from method prefix and method specific ID.
    const did = `${didMethodPrefix}:${methodSpecificId}`;
    // Return deterministic DID & DID Document.
    return {
      did,
      didDocument: {
        ...interDidDoc,
        id: did,
        verificationMethod: [{
          id: '#initialKey',
          type: 'JsonWebKey',
          controller: did,
          publicKeyJwk: jwk
        }]
      } as DidDocument
    };
  }

  public static async createSidecar({ interDidDoc, options: { version, jwk } }: {
    interDidDoc: IntermediateDidDocument;
    options: DidBtc1CreateOptions<LocalKeyManager>;
  }): Promise<DidBtc1CreateResponse> {
    // Set the did method prefix based on the version.
    const didMethodPrefix = version !== 1
      ? `did:${this.methodName}:${version}:x1`
      : `did:${this.methodName}`;
    // Create CID from the DID Document.
    const cid = CID.create(1, json.code, await sha256.digest(json.encode(interDidDoc)));
    // Bech32 encode the CID bytes with 'x' hrp.
    const methodSpecificId = bech32.encode('x', bech32.toWords(cid.bytes));
    // Create DID from method prefix and method specific ID.
    const did = `${didMethodPrefix}:${methodSpecificId}`;
    // Return deterministic DID & DID Document.
    return {
      did,
      didDocument: {
        ...interDidDoc,
        id: did,
        verificationMethod: [{
          id: '#initialKey',
          type: 'JsonWebKey',
          controller: did,
          publicKeyJwk: jwk
        }]
      } as DidDocument
    };
  }

  /**
   * Given the W3C DID Document of a `did:btc1` DID, return the verification method that will be used
   * for signing messages and credentials. If given, the `methodId` parameter is used to select the
   * verification method. If not given, the Identity Key's verification method with an ID fragment
   * of '#initialKey' is used.
   *
   * @param params - The parameters for the `getSigningMethod` operation.
   * @param params.didDocument - DID Document to get the verification method from.
   * @param params.methodId - ID of the verification method to use for signing.
   * @returns Verification method to use for signing.
   */
  public static async getSigningMethod({ didDocument, methodId = '#initialKey' }: {
    didDocument: DidDocument;
    methodId?: string;
  }): Promise<DidVerificationMethod> {
    // Verify the DID method is supported.
    const parsedDid = Did.parse(didDocument.id);
    if (parsedDid && parsedDid.method !== this.methodName) {
      throw new DidError(DidErrorCode.MethodNotSupported, `Method not supported: ${parsedDid.method}`);
    }

    // Attempt to find a verification method that matches the given method ID, or if not given,
    // find the first verification method intended for signing claims.
    const verificationMethod = didDocument.verificationMethod?.find(
      vm => extractDidFragment(vm.id) === (extractDidFragment(methodId) ?? extractDidFragment(didDocument.assertionMethod?.[0]))
    );
    if (!(verificationMethod && verificationMethod.publicKeyJwk)) {
      throw new DidError(DidErrorCode.InternalError, 'A verification method intended for signing could not be determined from the DID Document');
    }

    return verificationMethod;
  }

  /**
   * TODO: Implement resolve method.
   *
   * Resolves a `did:btc1` identifier to its corresponding DID document.
   *
   * This method performs the resolution of a `did:btc1` DID, retrieving its DID Document.
   *
   * @example
   * ```ts
   * const resolutionResult = await DidBtc1.resolve('did:btc1:example');
   * ```
   *
   * @param identifier - The DID to be resolved.
   * @param options - Optional parameters for resolving the DID. Unused by this DID method.
   * @returns A Promise resolving to a {@link DidResolutionResult} object representing the result of
   *          the resolution.
   */
  public static async resolve(identifier: string, options: DidResolutionOptions = {}): Promise<DidResolutionResult> {
    // To execute the read method operation, use the given gateway URI or a default.
    const aggregatorUri = options?.aggregatorUri ?? '<DEFAULT_AGGREGATOR_URI>';
    // const network = options?.network ?? '<DEFAULT_NETWORK>';
    // const cidBytes = bech32.decode(identifier);
    try {
      throw new Error('Not implemented: ' + aggregatorUri);
    } catch (error: any) {
      // Rethrow any unexpected errors that are not a `DidError`.
      if (!(error instanceof DidError)) throw new Error(error);

      // Return a DID Resolution Result with the appropriate error code.
      return {
        ...EMPTY_DID_RESOLUTION_RESULT,
        didResolutionMetadata: {
          error: error.code,
          ...error.message && { errorMessage: error.message }
        }
      };
    }
  }
}