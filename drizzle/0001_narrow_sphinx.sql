CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`base_revision` integer NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`result` text,
	`message` text DEFAULT '' NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_created` ON `agent_runs` (`created_at`);