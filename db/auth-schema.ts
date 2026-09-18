import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
const stamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
export const user = sqliteTable('auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  createdAt: stamp('created_at').notNull(),
  updatedAt: stamp('updated_at').notNull(),
});
export const session = sqliteTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: stamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: stamp('created_at').notNull(),
    updatedAt: stamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('idx_auth_session_user').on(t.userId)],
);
export const account = sqliteTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: stamp('access_token_expires_at'),
    refreshTokenExpiresAt: stamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: stamp('created_at').notNull(),
    updatedAt: stamp('updated_at').notNull(),
  },
  (t) => [
    index('idx_auth_account_user').on(t.userId),
    uniqueIndex('idx_auth_account_provider').on(t.providerId, t.accountId),
  ],
);
export const verification = sqliteTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: stamp('expires_at').notNull(),
    createdAt: stamp('created_at').notNull(),
    updatedAt: stamp('updated_at').notNull(),
  },
  (t) => [index('idx_auth_verification_identifier').on(t.identifier)],
);
export const rateLimit = sqliteTable('auth_rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
});
