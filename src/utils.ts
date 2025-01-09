export function extractDidFragment(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  if (input.length === 0) return undefined;
  return input;
}

export function bigintToBuffer(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}