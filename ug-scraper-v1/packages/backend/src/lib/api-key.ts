import { createHash } from 'node:crypto';
import { CLIENT_ID } from './client-id.js';

/**
 * Generates the X-UG-API-KEY for a given moment in time.
 *
 * Formula (from ADR and validated in spike):
 *   input = clientID + "YYYY-MM-DD" + ":" + H + "createLog()"
 *   key   = MD5(input).hexDigest()
 *
 * Where H is UTC hour as a plain integer string — no zero-padding.
 */
export function generateApiKey(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const hour = String(now.getUTCHours()); // no zero-padding
  const input = `${CLIENT_ID}${date}:${hour}createLog()`;
  return createHash('md5').update(input).digest('hex');
}

export { CLIENT_ID };
