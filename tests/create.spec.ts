import { expect } from 'chai';
import { DidBtc1 } from '../src/did-btc1.js';

describe('DidBtc1 Create', () => {

    /**
     * @description Create a new did and did document using default settings (deterministic)
     */
    describe('response (deterministic)', async () => {
        const response = await DidBtc1.create();
        // Check existence and typeof "did"
        it('should contain property "did" as a string', () => {
            expect(response).to.have.property('did').that.is.a('string');
        });

        describe('response.did', () => {
            // Validate the did format
            it('should contain string literal "did" "btc1" and "k1"', () => {
                const [did, method, id] = response.did.split(':');
                expect(did).to.equal('did');
                expect(method).to.equal('btc1');
                expect(id).to.be.a('string').and.to.match(/k1.*/)
            });
        })
        // Check existence and typeof "didDocument"
        it('should contain property "didDocument" as an object', () => {
            expect(response).to.have.property('didDocument').that.is.an('object');
        });

        describe('response.didDocument', () => {
            // Check specific type of "didDocument" as type DidDocument
            it('should be an object of type DidDocument', () => {
                expect(typeof response.didDocument).equals('object');
            });
        });

        // Check existence and typeof "mnemonic"
        it('should contain property "mnemonic" as a string', () => {
            expect(response).to.have.property('mnemonic').that.is.a('string');
        });

        describe('response.mnemonic', () => {
            // Check existence and typeof "mnemonic" word length
            it('should contain 12 words', () => {
                expect(response.mnemonic?.split(' ')).to.have.lengthOf(12);
            });
        });
    });

    /**
    * @description Create a new did and did document using custom settings (sidecar / non-deterministic)
    */
    describe('response (sidecar / non-deterministic)', async () => {
        const response = await DidBtc1.create({ options: { type: 'sidecar' } });
        // Check existence and typeof response property "did"
        it('should contain property "did" as a string', () => {
            expect(response).to.have.property('did').that.is.a('string');
        });

        describe('response.did', () => {
            // Validate the did format
            it('should contain string literal "did" "btc1" and "x1"', () => {
                const [did, method, id] = response.did.split(':');
                expect(did).to.equal('did');
                expect(method).to.equal('btc1');
                expect(id).to.be.a('string').and.to.match(/x1.*/);
            });
        });

        // Check existence and generic typeof "didDocument"
        it('should contain property "didDocument" as an object', () => {
            expect(response).to.have.property('didDocument').that.is.an('object');
        });

        describe('response.didDocument', () => {
            // Check specific type of "didDocument" as type DidDocument
            it('should be typeof DidDocument', () => {
                expect(typeof response.didDocument).equals('object');
            });
        });

        // Check non-existence of "mnemonic"
        it('should not contain property "mnemonic"', () => {
            expect(response).not.to.have.property('mnemonic');
        });
    });
});