import { env } from '@cio/core/config/env';

export * from './rate-limiter';

export const API_PORT = env.PORT ? parseInt(env.PORT) : 3002;
export const API_SERVER_URL = env.PUBLIC_SERVER_URL || `http://localhost:${API_PORT}`;
const configuredTrustedOrigins = env.TRUSTED_ORIGINS
  ? env.TRUSTED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5180', 'https://*.classroomio.com', 'https://*.myclassroomio.com'];

export const TRUSTED_ORIGINS = [
  ...configuredTrustedOrigins.map((origin) => origin.trim()).filter(Boolean),
  ...(env.DASHBOARD_ORIGIN ? [env.DASHBOARD_ORIGIN.trim().replace(/\/$/, '')] : [])
];
