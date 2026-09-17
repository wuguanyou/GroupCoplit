import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});
export const agentRuns = sqliteTable(
  'agent_runs',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    baseRevision: integer('base_revision').notNull(),
    status: text('status').notNull(),
    input: text('input').notNull(),
    result: text('result'),
    message: text('message').notNull().default(''),
    model: text('model').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_agent_runs_created').on(table.createdAt)],
);
