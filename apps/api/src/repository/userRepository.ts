import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { accounts, adminRoles, refreshTokens, users, type User } from "@attune/db/schema";
import type { OAuthProvider, UserRole } from "@attune/types";

export interface CreateUserData {
  email: string;
  passwordHash?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  email?: string;
  passwordHash?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
  disabledAt?: Date | null;
}

export interface CreateAccountData {
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  return user;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash ?? null,
      name: data.name ?? null,
      avatarUrl: data.avatarUrl ?? null,
      timezone: data.timezone ?? "Asia/Kolkata",
      role: data.role ?? "USER",
    })
    .returning();
  return user;
}

export async function updateUser(id: string, data: UpdateUserData): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function updateUserEmail(id: string, newEmail: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ email: newEmail.toLowerCase().trim() })
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.userId, userId));
}

export async function findLinkedAccounts(userId: string) {
  return db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}

export async function findAccountByProvider(provider: OAuthProvider, providerAccountId: string) {
  const [acct] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, providerAccountId),
      ),
    );
  return acct;
}

export async function createAccount(data: CreateAccountData) {
  const [created] = await db
    .insert(accounts)
    .values(data)
    .onConflictDoNothing()
    .returning();
  return created;
}

export async function createRefreshToken(data: CreateRefreshTokenData) {
  const [token] = await db.insert(refreshTokens).values(data).returning();
  return token;
}

export async function findRefreshTokenByHash(tokenHash: string) {
  const [row] = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      revokedAt: refreshTokens.revokedAt,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));
  return row;
}

export async function revokeRefreshToken(tokenHash: string) {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserTokens(userId: string) {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} IS NULL`));
}

export async function listUsers(query: { q?: string; limit: number; offset: number }) {
  const q = query.q?.trim();
  const whereCondition = q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        adminRoleId: users.adminRoleId,
        adminRoleName: adminRoles.name,
        timezone: users.timezone,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
        topicCount: sql<number>`(SELECT count(*) FROM user_topics ut WHERE ut.user_id = ${users.id})`,
        deviceCount: sql<number>`(SELECT count(*) FROM devices d WHERE d.user_id = ${users.id})`,
        lastActive: sql<string | null>`(SELECT max(it.created_at) FROM interactions it WHERE it.user_id = ${users.id})`,
      })
      .from(users)
      .leftJoin(adminRoles, eq(users.adminRoleId, adminRoles.id))
      .where(whereCondition)
      .orderBy(desc(users.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(users)
      .where(whereCondition),
  ]);

  return {
    users: rows.map((r) => ({
      ...r,
      disabledAt: r.disabledAt ? r.disabledAt.toISOString() : null,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString(),
      topicCount: Number(r.topicCount ?? 0),
      deviceCount: Number(r.deviceCount ?? 0),
      adminRoleId: r.adminRoleId ?? null,
      adminRoleName: r.adminRoleName ?? null,
    })),
    total: Number(countRow?.total ?? 0),
  };
}

export async function setUserDisabled(id: string, disabled: boolean) {
  const [updated] = await db
    .update(users)
    .set({ disabledAt: disabled ? new Date() : null })
    .where(eq(users.id, id))
    .returning({ id: users.id, disabledAt: users.disabledAt });

  if (disabled && updated) {
    await revokeAllUserTokens(id);
  }

  return updated;
}
