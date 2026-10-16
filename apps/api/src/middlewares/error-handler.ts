import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const requestId = String(response.locals.requestId ?? 'unknown');
  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    (error.type === 'entity.too.large' || error.type === 'entity.parse.failed')
  ) {
    response
      .status(error.type === 'entity.too.large' ? 413 : 400)
      .json({
        success: false,
        error: { code: 'INVALID_BODY', message: 'اندازه یا محتوای درخواست معتبر نیست.', requestId },
      });
    return;
  }

  if (error instanceof ZodError) {
    response.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'اطلاعات واردشده معتبر نیست.',
        fields: error.flatten().fieldErrors,
        requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
        requestId,
      },
    });
    return;
  }

  console.error(JSON.stringify({ level: 'error', requestId, message: 'Unhandled request error' }));
  response.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'خطایی رخ داده است. دوباره تلاش کنید.',
      requestId,
    },
  });
};
