import type { ApiErrorBody } from '@marketplace/contracts';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { zodDetails } from '../lib/http.js';
import { isRecordNotFound, isUniqueViolation } from '../lib/prisma-errors.js';

function sendError(res: Response, status: number, error: ApiErrorBody): void {
  res.status(status).json({ success: false, data: null, error, meta: {} });
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, {
    code: 'NOT_FOUND',
    message: `No route for ${req.method} ${req.path}.`,
  });
};

/** Body-parser errors carry an HTTP status and a `type` string. */
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const requestId = typeof req.id === 'string' ? req.id : String(req.id ?? '');

  if (error instanceof AppError) {
    sendError(res, error.status, {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  if (error instanceof ZodError) {
    const details = zodDetails(error);
    sendError(res, 400, {
      code: 'VALIDATION_ERROR',
      message: details[0]?.message ?? 'Invalid request.',
      details,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'The file is larger than 5 MB.' });
    } else {
      sendError(res, 400, {
        code: 'VALIDATION_ERROR',
        message: 'Upload exactly one image in the "image" field.',
      });
    }
    return;
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.too.large') {
      sendError(res, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' });
      return;
    }
    if (error.status >= 400 && error.status < 500) {
      sendError(res, 400, { code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' });
      return;
    }
  }

  // Safety nets for races that slip past the services' own checks.
  if (isUniqueViolation(error)) {
    sendError(res, 409, { code: 'CONFLICT', message: 'A record with the same value already exists.' });
    return;
  }
  if (isRecordNotFound(error)) {
    sendError(res, 404, { code: 'NOT_FOUND', message: 'Resource not found.' });
    return;
  }

  req.log.error({ err: error }, 'Unhandled error');
  sendError(res, 500, {
    code: 'INTERNAL',
    message: 'Something went wrong on our side. Please try again.',
    requestId,
  });
};
