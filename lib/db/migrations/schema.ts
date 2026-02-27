import { pgTable, uuid, text, real, timestamp, foreignKey, varchar, jsonb, unique } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"




export const leaderboard = pgTable("Leaderboard", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	girlName: text().notNull(),
	girlImg: text().notNull(),
	boyName: text().notNull(),
	amount: real().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const character = pgTable("character", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	image: text().notNull(),
	name: text().notNull(),
	gender: varchar({ length: 10 }).notNull(),
	birthday: text().notNull(),
	zodiac: text().notNull(),
	bloodType: text().notNull(),
	personality: text(),
	tag: text(),
	englishName: text("english_name"),
	mbti: text().notNull(),
	birthplace: text(),
	education: text(),
	appearance: text(),
	detail: text(),
	uniformDetail: jsonb("uniform_detail"),
	systemPrompt: text("system_prompt"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		characterUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "character_userId_user_id_fk"
		}).onDelete("cascade"),
	}
});

export const systemPromptTemplate = pgTable("SystemPromptTemplate", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	name: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		systemPromptTemplateUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SystemPromptTemplate_userId_user_id_fk"
		}).onDelete("cascade"),
	}
});

export const user = pgTable("user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }),
	username: varchar({ length: 255 }),
	userimage: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		userEmailUnique: unique("user_email_unique").on(table.email),
	}
});

export const userApiSettings = pgTable("user_api_settings", {
	userId: uuid("user_id").primaryKey().notNull(),
	apiUrl: text("api_url").notNull(),
	apiKey: text("api_key").notNull(),
	selectedModel: text("selected_model"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userApiSettingsUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_api_settings_user_id_user_id_fk"
		}).onDelete("cascade"),
	}
});