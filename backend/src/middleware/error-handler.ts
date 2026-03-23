import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';

/**
 * Structured error response following the design doc format:
 * { success: false, error: { code, message, requestId } }
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        requestId,
      },
    });
    return;
  }

  // Known error patterns
  const message = err.message || 'Internal server error';

  if (message.includes('Insufficient') || message.includes('balance')) {
    res.status(400).json({ success: false, error: { code: 'BALANCE_INSUFFICIENT', message, requestId } });
    return;
  }
  if (message.includes('not found') || message.includes('Not found')) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message, requestId } });
    return;
  }
  if (message.includes('no longer available') || message.includes('cancelled') || message.includes('sold')) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_LISTING_UNAVAILABLE', message, requestId } });
    return;
  }
  if (message.includes('exceeds available') || message.includes('exceeds')) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_QUANTITY_EXCEEDED', message, requestId } });
    return;
  }
  if (message.includes('Token IDs not configured') || message.includes('not configured')) {
    res.status(502).json({ success: false, error: { code: 'HEDERA_CONFIG_ERROR', message, requestId } });
    return;
  }

  // Hedera SDK errors (INSUFFICIENT_PAYER_BALANCE, TOKEN_NOT_ASSOCIATED, etc.)
  if (message.includes('INSUFFICIENT') || message.includes('payer') || message.includes('tinybars')) {
    res.status(400).json({ success: false, error: { code: 'HEDERA_INSUFFICIENT_FUNDS', message: 'Insufficient HBAR balance to complete this transaction. The buyer account needs more HBAR.', requestId } });
    return;
  }
  if (message.includes('TOKEN_NOT_ASSOCIATED') || message.includes('associate')) {
    res.status(400).json({ success: false, error: { code: 'HEDERA_TOKEN_NOT_ASSOCIATED', message: 'WSC token is not associated with the account. Please associate the token first.', requestId } });
    return;
  }

  // Default: internal server error
  console.error(`[${requestId}] Unhandled error:`, err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: message || 'An unexpected error occurred', requestId } });
}
