import { DidBtc1 } from '../src/did-btc1.js';

describe('applicant = new DcxApplicant({ config: applicantConfig })', () => {

    /**
     * @description Create a new did and did document using default settings (deterministic)
     */
    describe('DidBtc1.create()', async () => {
        const response = await DidBtc1.create();
        // Check response property "did"
        it('should contain property "did" as a string', () => {
            expect(response).to.have.property('did').that.is.a('string');
        });

        // Validate the did format
        it('should contain property "did" as a string', () => {
            expect(applicant.status).to.have.property('initialized').that.is.a('boolean').and.to.be.false;
        });

        // Check response property "didDocument"
        it('should contain property "setup" as a boolean equal to false', () => {
            expect(applicant.status).to.have.property('setup').that.is.a('boolean').and.to.be.false;
        });
        
        // Check response property "mnemonic"
    });

    console.log('deterministic', deterministic);

    const sidecar = await DidBtc1.create({ options: { type: 'sidecar' } });
    console.log('sidecar', sidecar);
});