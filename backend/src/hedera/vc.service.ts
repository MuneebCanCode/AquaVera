import { v4 as uuidv4 } from 'uuid';
import { getPlatformDID } from './did.service';
import { StewardshipLevel } from '../types/enums';

export interface VCSubject {
  organizationName: string;
  organizationDID: string;
  quantityRetired: number;
  equivalentLiters: number;
  stewardshipLevel: StewardshipLevel;
  verificationYear: number;
  sourceWatershed: string;
  complianceFramework: string;
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: VCSubject;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
}

/**
 * Create a W3C Verifiable Credential for a water stewardship retirement.
 */
export function createVerifiableCredential(
  subject: VCSubject
): VerifiableCredential {
  const platformDID = getPlatformDID();
  const now = new Date();
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const vcId = `urn:uuid:${uuidv4()}`;

  // In production, this would use the platform private key for real signing.
  // For testnet demo, we create a placeholder proof.
  const proofValue = Buffer.from(
    JSON.stringify({ vcId, issuer: platformDID, timestamp: now.toISOString() })
  ).toString('base64');

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://aquavera.io/credentials/v1',
    ],
    id: vcId,
    type: ['VerifiableCredential', 'WaterStewardshipCredential'],
    issuer: platformDID,
    issuanceDate: now.toISOString(),
    expirationDate: endOfYear.toISOString(),
    credentialSubject: subject,
    proof: {
      type: 'Ed25519Signature2020',
      created: now.toISOString(),
      verificationMethod: `${platformDID}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue,
    },
  };
}
