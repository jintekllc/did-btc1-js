# DID BTC1 Notes

## Abstract

* off-chain DID creation
* aggregated on-chain DID Document updates
* off-chain DID / DID Document creation
* private DID Documents (communication and resolution)
* non-repudiation of the DID and DID Document

## Introduction and Motivation

* Pairwise DIDs: DIDs created for every different special purpose
  * Methodology implemented by Web5 Agent design
* Pairwise DIDs leak every time the DID is used making them no longer private
* Sidecar delivery is a method of sharing an offline, private DID and DID Doc with another party willing to cooperate with the privacy reqiurements of the sharing party
* The receiving party must be willing to act as their own resolver
* The Sidecar data includes the DID, DID Doc, and a partial proof to allow the receiver to trace the document update history
* Uses Bitcoin's Blochain as timechain of DID Document updates to establish a chain-of-custody
  * Enables non-repudiation of the DID and DID Document
* Other did method comparisons
  * btcr: stores doc on chain in OP RETURN; non-private; expensive; repudiable
  * ion: repudiable / late publishing vulnerable; non-private on IPFS
  * btco: stores doc on-chain as inscription; non-private; expensive
  * btc: uses inscriptions optionally; adds batching; data non-private, on-chain; expensive
* btc1 features
  * uses bitcoin blockchain as timechain
  * allows for offline DID creation (no on-chain tx required)
  * introduces aggregators to mitigate update costs
  * enables non-repudiation and avoids late-publishing by validating full update history
  * enables private dids & did docs:
    * via off-chain Sidecar did history data
    * via DID history inclusion as SMT within on-chain txs
  * reduces resolution work by filtering txs for updates about specific DIDs of interest
  * flexible inclusion of any key type in DID Doc
  * seed words can deterministically recover DID
  * using descriptors instead of address in did doc enables non-reuse of addresses
* btc1 limitations
  * resolvers require read-only access to all bitcoin blocks
  * controllers are responsible for storing and providing data required to verify against the "beacons" (did, did doc, cid, smt)
  * invalid references by beacons require scripts allowing for controllers to veto and UTXO sharing
  * ZCAPs needed to update part of did doc
  * Aggregators won't scale well until covenants enabled (CTV, CAT)
* Questions
  * Does non-repudiation (non-inclusion) scale?
  * What about discoverability? This seems to take us further away from solving that problem.

## Terminology

* Beacon: DID doc update mechanism
  * Form of a bitcoin address as service object in DID Doc
  * Spending from beacon adderss => DID update announcements
  * Two types of beacons
    * Singleton: single entity to independently post update; every did doc will have 1 singleton as fallback
    * Aggregate: multiple entities collectively announce did updates
* Beacon Signal: bitcoin transactions spending from a beacon address including OP_RETURN <32_bytes>
  * Announce 1+ did updates and a means for verification
  * Two types of aggregator beacons:
    * SMTAggregator
    * CIDAggregator

## Syntax

1. `did:btc` (required)
2. `version` (optional, implied to be 1)
3. `network` (optional, implied to be mainnet)
4. `method-id` (required; `k1` + bech32 encoded secp256k1 pubkey || `x1` + hash of initial did doc)

* Examples
  * pubkey - version - network: `did:btc1:k1t5rm7vud58tyspensq9weyxc49cyxyvyh72w0n5hc7g5t859aq7sz45d5a`
  * pubkey + version + network: `did:btc1:1:mainnet:k1t5rm7vud58tyspensq9weyxc49cyxyvyh72w0n5hc7g5t859aq7sz45d5a`
  * doc - version - network: `did:btc1:x1<hash>`
  * doc + version + network: `did:btc1:1:mainnet:x1<hash>`

## CRUD Ops - CREATE

* Notes
  * The title of section 4.1.2 is confusing by being labeled "offline".
  * Both cases can be done "offline".
  * The title of section 4.1.2, "Offline Did Document", implies that only the Sidecar method can be done offline
  * Examples of each did document would be helpful for understanding and implementation

* Questions
  * Are we not using the y coordinate of the hd pubkey for the JwkPubKey?
    * The comments in @web5/crypto/jose/jwk state: "y MUST be present only for secp256k1 public keys"

* Deterministic creation from a cryptographic seed
* Sidecar creation from some initiating arbitrary DID document
* Both can be done offline (no on-chain tx required)
* Deterministic
  * encodes a Secp256k1 public key
  * uses public key to deterministically generate initial DID document
  * Steps
    * version = 1
    * network = mainnet
    * gen secp256k1 key pair
    * bech32 encode 'k' + pubkey
    * return fully formed did = did:btc1:<version>:<network>:<bech32_secp_pubkey>
* Sidecar
  * Created from some initiating arbitrary DID document
  * Enables Service Endpoints and Beacons for aggregation
  * MUST have verification method but VM cannot have controller
  * Creates a bit of a paradox implementation wise since VM is required in spec but controller cannot be there; Conflicts with implemented types in TypeScript W3C implementation

## CRUD Ops - Read

* @params did; @returns didDoc
* Retrieve / generate didDoc for DID and process all Beacons
* Apply updates to didDoc as appropriate in specified order (based on version)
* Update chain must form continuous ordered set else invalid did (late publishing)
