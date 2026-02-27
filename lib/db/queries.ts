import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  type User,
  userApiSettings,
  type UserApiSettings,
  character,
  type Character,
  systemPromptTemplate,
  type SystemPromptTemplate,
  guessingDickLeaderboard,
  type GuessingDickLeaderboard,

} from "./schema";
import { eq, desc, and } from "drizzle-orm";
import { Gender } from '@/utils/character';

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUsers() {
  return await db.select().from(user);
}

export async function createUser(email: string, password: string, username: string, userimage: string) {
  return await db
    .insert(user)
    .values({ email, password, username, userimage })
    .returning();
}

export async function getUserByEmail(email: string) {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.email, email));

  return result[0] ?? null;
}

// -------------------------------------------------------------------

export async function getUserApiSettings(userId: string) {
  const result = await db
    .select()
    .from(userApiSettings)
    .where(eq(userApiSettings.userId, userId));
  return result[0] ?? null;
}

export async function upsertUserApiSettings(
  userId: string,
  data: Pick<UserApiSettings, 'apiUrl' | 'apiKey' | 'selectedModel'>
) {
  // 使用 onConflictDoUpdate 實現 upsert
  const result = await db
    .insert(userApiSettings)
    .values({
      userId,
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
      selectedModel: data.selectedModel,
    })
    .onConflictDoUpdate({
      target: userApiSettings.userId,
      set: {
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        selectedModel: data.selectedModel,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result[0] ?? null;
}

export async function deleteUserApiSettings(userId: string) {
  const result = await db
    .delete(userApiSettings)
    .where(eq(userApiSettings.userId, userId))
    .returning();
  return result[0] ?? null;
}

// -------------------------------------------------------------------

export async function getCharactersByUser(userId: string) {
  return await db
    .select()
    .from(character)
    .where(eq(character.userId, userId));
}

export async function getGirlsByUser(userId: string) {
  return await db
    .select()
    .from(character)
    .where(
      and(
        eq(character.userId, userId),
        eq(character.gender, Gender.FEMALE)
      )
    );
}

export async function getBoysByUser(userId: string) {
  return await db
    .select()
    .from(character)
    .where(
      and(
        eq(character.userId, userId),
        eq(character.gender, Gender.MALE)
      )
    );
}

export async function getCharacterById(id: string) {
  const result = await db
    .select()
    .from(character)
    .where(eq(character.id, id));
  return result[0] ?? null;
}

export async function createCharacter(
  data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>
) {
  const result = await db
    .insert(character)
    .values(data)
    .returning();
  return result[0];
}

export async function updateCharacter(
  id: string,
  data: Partial<Omit<Character, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
) {
  const result = await db
    .update(character)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(character.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deleteCharacter(id: string) {
  const result = await db
    .delete(character)
    .where(eq(character.id, id))
    .returning();
  return result[0] ?? null;
}

// -------------------------------------------------------------------

export async function getSystemPromptTemplates(userId: string) {
  return await db
    .select()
    .from(systemPromptTemplate)
    .where(eq(systemPromptTemplate.userId, userId));
}

export async function getSystemPromptTemplateById(id: string) {
  const result = await db
    .select()
    .from(systemPromptTemplate)
    .where(eq(systemPromptTemplate.id, id));

  return result[0] ?? null;
}

export async function createSystemPromptTemplate(
  data: Pick<SystemPromptTemplate, "userId" | "name" | "content">
) {
  const result = await db
    .insert(systemPromptTemplate)
    .values({
      userId: data.userId,
      name: data.name,
      content: data.content,
    })
    .returning();
  return result[0];
}

export async function updateSystemPromptTemplate(
  id: string,
  data: Partial<Pick<SystemPromptTemplate, "name" | "content">>
) {
  const result = await db
    .update(systemPromptTemplate)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(systemPromptTemplate.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteSystemPromptTemplate(id: string) {
  const result = await db
    .delete(systemPromptTemplate)
    .where(eq(systemPromptTemplate.id, id))
    .returning();

  return result[0] ?? null;
}

// -------------------------------------------------------------------

export async function createGuessingDickLeaderboardEntry(
  data: Pick<GuessingDickLeaderboard, "girlName" | "girlImg" | "boyName" | "amount">
) {
  const result = await db
    .insert(guessingDickLeaderboard)
    .values({
      girlName: data.girlName,
      girlImg: data.girlImg,
      boyName: data.boyName,
      amount: data.amount,
    })
    .returning();

  return result[0];
}

export async function getGuessingDickLeaderboard(limit: number = 10) {
  return await db
    .select()
    .from(guessingDickLeaderboard)
    .orderBy(desc(guessingDickLeaderboard.amount)) // 按金額降序
    .limit(limit);
}

export async function deleteGuessingDickLeaderboardEntry(id: string) {
  const result = await db
    .delete(guessingDickLeaderboard)
    .where(eq(guessingDickLeaderboard.id, id))
    .returning();

  return result[0] ?? null;
}

// -------------------------------------------------------------------



// -------------------------------------------------------------------
