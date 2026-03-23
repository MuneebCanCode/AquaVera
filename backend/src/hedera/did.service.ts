import { getOperatorAccountId } from './client';

/**
 * Create a Hedera DID for a user account.
 * Uses the Hedera DID Method: did:hedera:testnet:{accountId}
 */
export function createDID(accountId: string): string {
  return `did:hedera:testnet:${accountId}`;
}

/**
 * Resolve a DID document from a Hedera DID string.
 * Returns a minimal DID document conforming to W3C DID Core spec.
 */
export function resolveDIDDocument(did: string): Record<string, unknown> {
  const accountId = did.replace('did:hedera:testnet:', '');

  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [
      {
        id: `${did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: accountId,
      },
    ],
    authentication: [`${did}#key-1`],
    assertionMethod: [`${did}#key-1`],
  };
}

/**
 * Get the platform DID from environment or derive from operator account.
 */
export function getPlatformDID(): string {
  if (process.env.PLATFORM_DID) return process.env.PLATFORM_DID;
  return createDID(getOperatorAccountId().toString());
}
