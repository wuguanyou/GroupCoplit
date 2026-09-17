import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});
export const agentRuns = sqliteTable(
  'agent_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().default('main'),
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

export const projectMembers = sqliteTable(
  'project_members',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
  },
  (t) => [
    index('idx_members_user').on(t.userId),
    uniqueIndex('idx_members_project_user').on(t.projectId, t.userId),
  ],
);
export const projectInvites = sqliteTable(
  'project_invites',
  {
    projectId: text('project_id').primaryKey(),
    token: text('token').notNull(),
  },
  (t) => [uniqueIndex('idx_invites_token').on(t.token)],
);
export const projectFiles = sqliteTable(
  'project_files',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    uploader: text('uploader').notNull(),
    name: text('name').notNull(),
    size: integer('size').notNull(),
    category: text('category').notNull(),
    taskId: text('task_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_files_project').on(t.projectId)],
);
