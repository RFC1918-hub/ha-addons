import { randomBytes } from 'node:crypto';

/**
 * Stable X-UG-CLIENT-ID for the lifetime of the process.
 * 16-char lowercase hex.
 */
export const CLIENT_ID: string = randomBytes(8).toString('hex');
