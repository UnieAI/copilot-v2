import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    timestamp,
    json,
    uuid,
    text,
    primaryKey,
    integer,
} from 'drizzle-orm/pg-core';
import type { AdapterAccount } from '@auth/core/adapters';

// ----------------------------------------------------------------------------
// 1. Auth & Users (NextAuth Compatible)
// ----------------------------------------------------------------------------

export const users = pgTable('user', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: timestamp('emailVerified', { mode: 'date' }),
    image: text('image'),

    // Custom fields
    role: varchar('role', { length: 50 }).notNull().default('pending'), // 'pending' | 'user' | 'admin' | 'super'
    provider: varchar('provider', { length: 100 }), // e.g. 'google', 'azure-ad'
    providerId: text('providerId'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable(
    'account',
    {
        userId: uuid('userId')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        type: text('type').$type<AdapterAccount['type']>().notNull(),
        provider: text('provider').notNull(),
        providerAccountId: text('providerAccountId').notNull(),
        refresh_token: text('refresh_token'),
        access_token: text('access_token'),
        expires_at: integer('expires_at'),
        token_type: text('token_type'),
        scope: text('scope'),
        id_token: text('id_token'),
        session_state: text('session_state'),
    },
    (account) => ({
        compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
    })
);

export const sessions = pgTable('session', {
    sessionToken: text('sessionToken').primaryKey(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
    'verificationToken',
    {
        identifier: text('identifier').notNull(),
        token: text('token').notNull(),
        expires: timestamp('expires', { mode: 'date' }).notNull(),
    },
    (vt) => ({
        compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
    })
);

// ----------------------------------------------------------------------------
// 2. Admin Settings (Singleton)
// ----------------------------------------------------------------------------

export const adminSettings = pgTable('admin_settings', {
    id: uuid('id').primaryKey().defaultRandom(),

    defaultUserRole: varchar('default_user_role', { length: 50 }).notNull().default('pending'),
    pendingMessage: text('pending_message').notNull().default('Your account is pending administrator approval.'),

    workModelUrl: text('work_model_url'),
    workModelKey: text('work_model_key'),
    workModelName: text('work_model_name'),

    taskModelUrl: text('task_model_url'),
    taskModelKey: text('task_model_key'),
    taskModelName: text('task_model_name'),

    visionModelUrl: text('vision_model_url'),
    visionModelKey: text('vision_model_key'),
    visionModelName: text('vision_model_name'),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 3. User Specific Configuration
// ----------------------------------------------------------------------------

export const userModels = pgTable('user_models', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    apiUrl: text('api_url').notNull(),
    apiKey: text('api_key').notNull(),
    modelList: json('model_list').notNull().default('[]'), // result from /v1/models

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mcpTools = pgTable('mcp_tools', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    url: text('url').notNull(),
    path: text('path').notNull(),
    type: text('type').notNull(),
    auth_type: text('auth_type').notNull(),
    key: text('key'),
    spec_type: text('spec_type').notNull(), // e.g. 'openapi'
    spec: text('spec').notNull(), // The actual raw spec text
    info: json('info').notNull().default('{}'),
    config: json('config').notNull().default('{}'),

    isActive: integer('is_active').default(1).notNull(), // 1 true, 0 false

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 4. Chat Interface
// ----------------------------------------------------------------------------

export const chatSessions = pgTable('chat_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    title: text('title').notNull().default('New Chat'),
    systemPrompt: text('system_prompt'),
    modelName: text('model_name').notNull(), // the model user selected for this chat

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('sessionId')
        .notNull()
        .references(() => chatSessions.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    role: varchar('role', { length: 50 }).notNull(), // 'user', 'assistant', 'system'
    content: text('content').notNull(),

    // store pre-processed text from docs/images, or metadata about the generation
    attachments: json('attachments').default('[]'),
    toolCalls: json('tool_calls').default('[]'), // store mcp tool calls if any

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 5. Chat File Attachments (one row per file per message)
// ----------------------------------------------------------------------------

export const chatFiles = pgTable('chat_files', {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
        .notNull()
        .references(() => chatMessages.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    data: text('data'),              // base64-encoded raw file
    parsedContent: text('parsed_content'), // result from Vision model or file parser

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// Export Type Definitions
// ----------------------------------------------------------------------------

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type AdminSettings = InferSelectModel<typeof adminSettings>;
export type UserModel = InferSelectModel<typeof userModels>;
export type McpTool = InferSelectModel<typeof mcpTools>;
export type ChatSession = InferSelectModel<typeof chatSessions>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type ChatFile = InferSelectModel<typeof chatFiles>;
