import { DidBtc1 } from '../src/did-btc1.js';
const deterministic = await DidBtc1.create();
console.log('deterministic', deterministic);

const sidecar = await DidBtc1.create({ options: { type: 'sidecar' } });
console.log('sidecar', sidecar);
