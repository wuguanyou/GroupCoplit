CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`nonce` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_project_id` ON `chat_messages` (`project_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_nonce` ON `chat_messages` (`project_id`,`user_id`,`nonce`);