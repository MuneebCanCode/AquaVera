import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenBurnTransaction,
  TransferTransaction,
  TokenAssociateTransaction,
  AccountId,
  PrivateKey,
  TokenId,
  Hbar,
  NftId,
} from '@hashgraph/sdk';
import { getHederaClient, getOperatorAccountId, getOperatorPrivateKey } from './client';
import { withRetry } from './retry';

// ─── Fungible Token Creation ─────────────────────────────────────────────────

export interface CreateFungibleTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  treasuryAccountId: AccountId;
  adminKey?: PrivateKey;
  supplyKey?: PrivateKey;
}

export async function createFungibleToken(
  params: CreateFungibleTokenParams
): Promise<{ tokenId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();
    const operatorKey = getOperatorPrivateKey();

    const tx = new TokenCreateTransaction()
      .setTokenName(params.name)
      .setTokenSymbol(params.symbol)
      .setDecimals(params.decimals)
      .setInitialSupply(params.initialSupply)
      .setTreasuryAccountId(params.treasuryAccountId)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setAdminKey(operatorKey)
      .setSupplyKey(operatorKey);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return { tokenId: receipt.tokenId!.toString() };
  }, 'createFungibleToken');
}

// ─── NFT Collection Creation ─────────────────────────────────────────────────

export interface CreateNFTCollectionParams {
  name: string;
  symbol: string;
  treasuryAccountId: AccountId;
  adminKey?: PrivateKey;
  supplyKey?: PrivateKey;
  maxSupply?: number;
}

export async function createNFTCollection(
  params: CreateNFTCollectionParams
): Promise<{ tokenId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();
    const operatorKey = getOperatorPrivateKey();

    const tx = new TokenCreateTransaction()
      .setTokenName(params.name)
      .setTokenSymbol(params.symbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(
        params.maxSupply ? TokenSupplyType.Finite : TokenSupplyType.Infinite
      )
      .setTreasuryAccountId(params.treasuryAccountId)
      .setAdminKey(operatorKey)
      .setSupplyKey(operatorKey);

    if (params.maxSupply) {
      tx.setMaxSupply(params.maxSupply);
    }

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return { tokenId: receipt.tokenId!.toString() };
  }, 'createNFTCollection');
}

// ─── Mint Fungible Tokens ────────────────────────────────────────────────────

export async function mintFungibleTokens(
  tokenId: string,
  amount: number
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .setAmount(amount);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'mintFungibleTokens');
}

// ─── Mint NFT ────────────────────────────────────────────────────────────────

export async function mintNFT(
  tokenId: string,
  metadata: Uint8Array
): Promise<{ transactionId: string; serialNumber: number }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .addMetadata(metadata);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return {
      transactionId: response.transactionId.toString(),
      serialNumber: receipt.serials[0].toNumber(),
    };
  }, 'mintNFT');
}

// ─── Burn Tokens ─────────────────────────────────────────────────────────────

export async function burnTokens(
  tokenId: string,
  amount: number
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TokenBurnTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .setAmount(amount);

    const response = await tx.execute(client);
    await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'burnTokens');
}

// ─── Transfer Tokens (simple) ────────────────────────────────────────────────

export async function transferTokens(
  tokenId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  fromKey: PrivateKey
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TransferTransaction()
      .addTokenTransfer(
        TokenId.fromString(tokenId),
        AccountId.fromString(fromAccountId),
        -amount
      )
      .addTokenTransfer(
        TokenId.fromString(tokenId),
        AccountId.fromString(toAccountId),
        amount
      )
      .freezeWith(client);

    const signed = await tx.sign(fromKey);
    const response = await signed.execute(client);
    await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'transferTokens');
}

// ─── Transfer NFT ────────────────────────────────────────────────────────────

export async function transferNFT(
  tokenId: string,
  serialNumber: number,
  fromAccountId: string,
  toAccountId: string,
  fromKey: PrivateKey
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const nftId = new NftId(TokenId.fromString(tokenId), serialNumber);

    const tx = new TransferTransaction()
      .addNftTransfer(
        nftId,
        AccountId.fromString(fromAccountId),
        AccountId.fromString(toAccountId)
      )
      .freezeWith(client);

    const signed = await tx.sign(fromKey);
    const response = await signed.execute(client);
    await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'transferNFT');
}

// ─── Associate Tokens ────────────────────────────────────────────────────────

export async function associateTokens(
  accountId: string,
  tokenIds: string[],
  accountKey: PrivateKey
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds(tokenIds.map((id) => TokenId.fromString(id)))
      .freezeWith(client);

    const signed = await tx.sign(accountKey);
    const response = await signed.execute(client);
    await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'associateTokens');
}

// ─── Atomic Transfer (multi-party trade with revenue split) ──────────────────

export interface AtomicTransferParams {
  /** WSC token ID */
  wscTokenId: string;
  /** Payment token ID (HBAR uses null, AVUSD uses token ID) */
  paymentTokenId: string | null;
  /** Seller account */
  sellerAccountId: string;
  /** Buyer account */
  buyerAccountId: string;
  /** Community fund account */
  communityAccountId: string;
  /** Verifier account */
  verifierAccountId: string;
  /** Platform treasury account */
  platformAccountId: string;
  /** WSC quantity to transfer */
  wscAmount: number;
  /** Payment amounts per recipient */
  sellerPayment: number;
  communityPayment: number;
  verifierPayment: number;
  platformPayment: number;
  /** Keys for signing */
  sellerKey: PrivateKey;
  buyerKey: PrivateKey;
}

export async function atomicTransfer(
  params: AtomicTransferParams
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TransferTransaction();

    // WSC: seller → buyer
    tx.addTokenTransfer(
      TokenId.fromString(params.wscTokenId),
      AccountId.fromString(params.sellerAccountId),
      -params.wscAmount
    );
    tx.addTokenTransfer(
      TokenId.fromString(params.wscTokenId),
      AccountId.fromString(params.buyerAccountId),
      params.wscAmount
    );

    if (params.paymentTokenId) {
      // AVUSD token transfers
      const payTokenId = TokenId.fromString(params.paymentTokenId);
      const totalPayment =
        params.sellerPayment +
        params.communityPayment +
        params.verifierPayment +
        params.platformPayment;

      tx.addTokenTransfer(payTokenId, AccountId.fromString(params.buyerAccountId), -totalPayment);
      tx.addTokenTransfer(payTokenId, AccountId.fromString(params.sellerAccountId), params.sellerPayment);
      tx.addTokenTransfer(payTokenId, AccountId.fromString(params.communityAccountId), params.communityPayment);
      tx.addTokenTransfer(payTokenId, AccountId.fromString(params.verifierAccountId), params.verifierPayment);
      tx.addTokenTransfer(payTokenId, AccountId.fromString(params.platformAccountId), params.platformPayment);
    } else {
      // HBAR transfers
      const totalHbar =
        params.sellerPayment +
        params.communityPayment +
        params.verifierPayment +
        params.platformPayment;

      tx.addHbarTransfer(AccountId.fromString(params.buyerAccountId), Hbar.fromTinybars(-totalHbar));
      tx.addHbarTransfer(AccountId.fromString(params.sellerAccountId), Hbar.fromTinybars(params.sellerPayment));
      tx.addHbarTransfer(AccountId.fromString(params.communityAccountId), Hbar.fromTinybars(params.communityPayment));
      tx.addHbarTransfer(AccountId.fromString(params.verifierAccountId), Hbar.fromTinybars(params.verifierPayment));
      tx.addHbarTransfer(AccountId.fromString(params.platformAccountId), Hbar.fromTinybars(params.platformPayment));
    }

    const frozen = tx.freezeWith(client);
    const signedBySeller = await frozen.sign(params.sellerKey);
    const signedByBoth = await signedBySeller.sign(params.buyerKey);
    const response = await signedByBoth.execute(client);
    await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'atomicTransfer');
}
