import {
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
} from '@hashgraph/sdk';
import { getHederaClient } from './client';
import { withRetry } from './retry';

/**
 * Deploy a smart contract to Hedera using ContractCreateFlow.
 * ContractCreateFlow handles file creation + contract creation in one step.
 */
export async function deployContract(
  bytecode: string,
  gas: number = 100000,
  constructorParams?: ContractFunctionParameters
): Promise<{ contractId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    let tx = new ContractCreateFlow()
      .setBytecode(bytecode)
      .setGas(gas);

    if (constructorParams) {
      tx = tx.setConstructorParameters(constructorParams);
    }

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return { contractId: receipt.contractId!.toString() };
  }, 'deployContract');
}

/**
 * Execute a function on a deployed smart contract.
 */
export async function executeContract(
  contractId: string,
  functionName: string,
  params: ContractFunctionParameters,
  gas: number = 75000,
  payableAmount?: number
): Promise<{ transactionId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    let tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(gas)
      .setFunction(functionName, params);

    if (payableAmount) {
      tx = tx.setPayableAmount(new Hbar(payableAmount));
    }

    const response = await tx.execute(client);
    await response.getReceipt(client);

    return { transactionId: response.transactionId.toString() };
  }, 'executeContract');
}
