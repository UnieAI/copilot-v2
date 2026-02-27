import { relations } from "drizzle-orm/relations";
import { user, character, systemPromptTemplate, userApiSettings } from "./schema";

export const characterRelations = relations(character, ({one}) => ({
	user: one(user, {
		fields: [character.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	characters: many(character),
	systemPromptTemplates: many(systemPromptTemplate),
	userApiSettings: many(userApiSettings),
}));

export const systemPromptTemplateRelations = relations(systemPromptTemplate, ({one}) => ({
	user: one(user, {
		fields: [systemPromptTemplate.userId],
		references: [user.id]
	}),
}));

export const userApiSettingsRelations = relations(userApiSettings, ({one}) => ({
	user: one(user, {
		fields: [userApiSettings.userId],
		references: [user.id]
	}),
}));