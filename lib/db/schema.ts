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
    boolean,
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

export const userProviders = pgTable('user_providers', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    enable: integer('enable').notNull().default(1),           // 1 = enabled, 0 = disabled
    displayName: text('display_name').notNull().default(''),   // user-defined display name
    prefix: varchar('prefix', { length: 4 }).notNull(),        // 4-char alphanumeric, unique per user

    apiUrl: text('api_url').notNull(),
    apiKey: text('api_key').notNull(),
    modelList: json('model_list').notNull().default('[]'),      // result from /v1/models (filtered)

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 4. Groups (org-level groups with shared providers)
// ----------------------------------------------------------------------------

export const groups = pgTable('groups', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Group Providers — identical structure to userProviders but scoped to a group
export const groupProviders = pgTable('group_providers', {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
        .notNull()
        .references(() => groups.id, { onDelete: 'cascade' }),

    enable: integer('enable').notNull().default(1),
    displayName: text('display_name').notNull().default(''),
    prefix: varchar('prefix', { length: 4 }).notNull(),

    apiUrl: text('api_url').notNull(),
    apiKey: text('api_key').notNull(),
    modelList: json('model_list').notNull().default('[]'),       // all models fetched from API
    selectedModels: json('selected_models').notNull().default('[]'), // admin-selected subset (IDs only)

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Many-to-many: users ↔ groups
export const userGroups = pgTable(
    'user_groups',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        groupId: uuid('group_id')
            .notNull()
            .references(() => groups.id, { onDelete: 'cascade' }),
        role: varchar('role', { length: 20 }).notNull().default('member'), // creator | editor | member
    },
    (t) => ({
        pk: primaryKey({ columns: [t.userId, t.groupId] }),
    })
);

export const userPreferences = pgTable('user_preferences', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: 'cascade' }),

    selectedModel: text('selected_model'),           // the model ID (e.g. 'gpt-4o')
    selectedProviderPrefix: text('selected_provider_prefix'), // provider prefix (e.g. 'OAI1')

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
// 5. Chat Projects / Folders
// ----------------------------------------------------------------------------

export const chatProjects = pgTable('chat_projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull().default('New Folder'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 6. Chat Interface
// ----------------------------------------------------------------------------

export const chatSessions = pgTable('chat_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId')
        .references(() => chatProjects.id, { onDelete: 'set null' }),

    title: text('title').notNull().default('New Chat'),
    systemPrompt: text('system_prompt'),
    modelName: text('model_name').notNull(), // the model user selected for this chat
    providerPrefix: text('provider_prefix'), // prefix of the provider this model belongs to

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

// Group token usage tracking (per user per group)
export const groupTokenUsage = pgTable('group_token_usage', {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
        .notNull()
        .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
        .references(() => chatSessions.id, { onDelete: 'set null' }),
    providerPrefix: varchar('provider_prefix', { length: 20 }),
    model: text('model'),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Platform-wide token usage (includes personal + group)
export const tokenUsage = pgTable('token_usage', {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
        .references(() => chatSessions.id, { onDelete: 'set null' }),
    providerPrefix: varchar('provider_prefix', { length: 20 }),
    model: text('model'),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Group quota per user (total)
export const groupUserQuotas = pgTable(
    'group_user_quotas',
    {
        groupId: uuid('group_id')
            .notNull()
            .references(() => groups.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        limitTokens: integer('limit_tokens'), // null => unlimited
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.groupId, t.userId] }),
    })
);

// Group quota per user per model
export const groupUserModelQuotas = pgTable(
    'group_user_model_quotas',
    {
        groupId: uuid('group_id')
            .notNull()
            .references(() => groups.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        model: text('model').notNull(),
        limitTokens: integer('limit_tokens'), // null => unlimited
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.groupId, t.userId, t.model] }),
    })
);

// Group quota per model (overall cap)
export const groupModelQuotas = pgTable(
    'group_model_quotas',
    {
        groupId: uuid('group_id')
            .notNull()
            .references(() => groups.id, { onDelete: 'cascade' }),
        model: text('model').notNull(),
        limitTokens: integer('limit_tokens'), // null => unlimited
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.groupId, t.model] }),
    })
);

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
export type UserProvider = InferSelectModel<typeof userProviders>;
export type UserPreference = InferSelectModel<typeof userPreferences>;
export type McpTool = InferSelectModel<typeof mcpTools>;
export type ChatProject = InferSelectModel<typeof chatProjects>;
export type ChatSession = InferSelectModel<typeof chatSessions>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type ChatFile = InferSelectModel<typeof chatFiles>;
export type Group = InferSelectModel<typeof groups>;
export type GroupProvider = InferSelectModel<typeof groupProviders>;
export type UserGroup = InferSelectModel<typeof userGroups>;
export type GroupTokenUsage = InferSelectModel<typeof groupTokenUsage>;
export type TokenUsage = InferSelectModel<typeof tokenUsage>;
export type GroupUserQuota = InferSelectModel<typeof groupUserQuotas>;
export type GroupUserModelQuota = InferSelectModel<typeof groupUserModelQuotas>;
export type GroupModelQuota = InferSelectModel<typeof groupModelQuotas>;
