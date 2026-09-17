CREATE TABLE `generation_rate_limits` (
	`identity_hash` text PRIMARY KEY NOT NULL,
	`window_started` integer NOT NULL,
	`count` integer NOT NULL
);
