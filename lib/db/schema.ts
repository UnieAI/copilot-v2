import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  real,
  integer,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';

export const user = pgTable("user", {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  username: varchar("username", { length: 255 }),
  userimage: text('userimage').notNull(), // base64 string
  createdAt: timestamp("created_at").defaultNow(),
});
export type User = InferSelectModel<typeof user>;

export const userApiSettings = pgTable('user_api_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  apiUrl: text('api_url').notNull(),
  apiKey: text('api_key').notNull(),
  selectedModel: text('selected_model'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export type UserApiSettings = InferSelectModel<typeof userApiSettings>;

export const character = pgTable('character', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 原本就有的欄位（優先保留原本定義）
  userId: uuid('userId')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  image: text('image').notNull(),
  name: text('name').notNull(),
  gender: varchar('gender', { length: 10 }).notNull(),
  birthday: text('birthday').notNull(),
  zodiac: text('zodiac').notNull(),
  bloodType: text('bloodType').notNull(),
  mbti: text('mbti').notNull(),

  // 從 girls / boys 額外帶進來的欄位
  englishName: text('english_name'),
  personality: text('personality'),
  birthplace: text('birthplace'),
  education: text('education'),
  appearance: text('appearance'),
  detail: text('detail'),

  // girls 特有欄位
  uniformDetail: jsonb('uniform_detail'),    // 選填，只有女生角色會有

  systemPrompt: text('system_prompt'),
  tag: text('tag'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
export type Character = InferSelectModel<typeof character>;

export const systemPromptTemplate = pgTable('SystemPromptTemplate', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});
export type SystemPromptTemplate = InferSelectModel<typeof systemPromptTemplate>;

export const guessingDickLeaderboard = pgTable('Leaderboard', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  girlName: text('girlName').notNull(),
  girlImg: text('girlImg').notNull(),
  boyName: text('boyName').notNull(),
  amount: real('amount').notNull(), // 使用 real 來儲存金額（浮點數）
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});
export type GuessingDickLeaderboard = InferSelectModel<typeof guessingDickLeaderboard>;
