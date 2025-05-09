/**
 * Client-side transaction utilities for serialization and deserialization 
 */

import { Transaction } from '@solana/web3.js';

/**
 * Deserialize a transaction from a base64 string with enhanced error handling
 *
 * @param {string} base64Transaction - Base64 encoded serialized transaction
 * @returns {Transaction} - Deserialized transaction object
 * @throws {Error} - Enhanced error with additional context
 */
export function deserializeTransaction(base64Transaction) {
  // Input validation
  if (!base64Transaction) {
    throw new Error('Failed to deserialize: No transaction data provided');
  }

  if (typeof base64Transaction !== 'string') {
    throw new Error(`Failed to deserialize: Expected a string, got ${typeof base64Transaction}`);
  }

  // Validate base64 format using regex
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Transaction)) {
    throw new Error('Failed to deserialize: Invalid base64 format');
  }

  try {
    // Base64 decoding
    const buffer = Buffer.from(base64Transaction, 'base64');

    // Check minimum size (needed for transaction header)
    if (buffer.length < 10) {
      throw new Error(`Failed to deserialize: Transaction data too short (${buffer.length} bytes)`);
    }

    // Check transaction size limit (Solana max transaction size: 1232 bytes)
    if (buffer.length > 1232) {
      throw new Error(`Failed to deserialize: Transaction size exceeds Solana limit (${buffer.length}/1232 bytes)`);
    }

    // Attempt to deserialize the transaction
    const tx = Transaction.from(buffer);

    // Basic transaction validation
    if (!tx.instructions || tx.instructions.length === 0) {
      console.warn('Warning: Deserialized transaction contains no instructions');
    }

    return tx;
  } catch (error) {
    // Create detailed error message
    console.error('Transaction deserialization error:', error);

    // Generate more specific error messages based on common failure patterns
    let errorMessage = 'Failed to deserialize transaction';

    if (error.message.includes('index out of bounds')) {
      errorMessage = 'Transaction data is malformed (index out of bounds)';
    } else if (error.message.includes('Invalid buffer')) {
      errorMessage = 'Invalid transaction data buffer';
    } else if (error.message.includes('Unsupported header')) {
      errorMessage = 'Unsupported transaction header';
    } else if (error.message.includes('not a base64 string')) {
      errorMessage = 'Not a valid base64 encoded string';
    } else {
      errorMessage = `${errorMessage}: ${error.message}`;
    }

    // Create enhanced error object with original error attached
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.code = 'TRANSACTION_DESERIALIZE_ERROR';
    enhancedError.transactionLength = base64Transaction?.length || 0;
    throw enhancedError;
  }
}

/**
 * Serialize a transaction for sending to the network
 * 
 * @param {Transaction} transaction - The transaction to serialize
 * @param {Object} options - Serialization options
 * @returns {Buffer} - Serialized transaction buffer
 */
export function serializeTransaction(transaction, options = {}) {
  const serializationOptions = {
    requireAllSignatures: options.requireAllSignatures ?? true,
    verifySignatures: options.verifySignatures ?? true
  };
  
  return transaction.serialize(serializationOptions);
}

/**
 * Check if a transaction has all required signatures
 * 
 * @param {Transaction} transaction - The transaction to check
 * @returns {boolean} - Whether all required signatures are present
 */
export function isFullySigned(transaction) {
  return transaction.signatures.every(signature => 
    signature.signature !== null
  );
}

/**
 * Utility to debug transaction signature issues
 * 
 * @param {Transaction} transaction - The transaction to check
 * @returns {Object} - Information about transaction signatures
 */
export function getTransactionSignatureInfo(transaction) {
  return {
    signatureCount: transaction.signatures.length,
    signatures: transaction.signatures.map((signerPubkeyAndSignature, index) => ({
      index,
      publicKey: signerPubkeyAndSignature.publicKey.toString(),
      hasSigned: signerPubkeyAndSignature.signature !== null,
      isFeePayerIndex: index === 0 && transaction.feePayer && 
                      transaction.feePayer.equals(signerPubkeyAndSignature.publicKey)
    }))
  };
}