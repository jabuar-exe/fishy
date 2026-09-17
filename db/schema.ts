import {integer,sqliteTable,text} from "drizzle-orm/sqlite-core";

/** Shared production quota state. Identity values are SHA-256 digests, never raw account ids or IPs. */
export const generationRateLimits=sqliteTable("generation_rate_limits",{
  identityHash:text("identity_hash").primaryKey(),
  windowStarted:integer("window_started").notNull(),
  count:integer("count").notNull(),
});
