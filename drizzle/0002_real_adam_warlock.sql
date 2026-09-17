CREATE TABLE `project_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`uploader` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`category` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_files_project` ON `project_files` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_invites` (
	`project_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invites_token` ON `project_invites` (`token`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_members_user` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_project_user` ON `project_members` (`project_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `project_id` text DEFAULT 'main' NOT NULL;