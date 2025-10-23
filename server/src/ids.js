import { customAlphabet } from 'nanoid';

// Uppercase alphanumeric without ambiguous chars (O/0, I/1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nano = customAlphabet(ALPHABET, 8); // 8-char ID

export function genOrderId() {
  return nano();
}
