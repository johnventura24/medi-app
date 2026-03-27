import * as Sentry from '@sentry/node';

export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[monitoring] SENTRY_DSN not set, error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% of transactions
    beforeSend(event) {
      // Strip any PHI from error reports
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        if (typeof data === 'object' && data !== null) {
          delete data.medications;
          delete data.chronicConditions;
          delete data.preferredDoctors;
          delete data.dateOfBirth;
          delete data.password;
          delete data.passwordHash;
        }
      }
      return event;
    }
  });

  console.log('[monitoring] Sentry initialized');
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
  console.error('[error]', error.message, context);
}

export { Sentry };
