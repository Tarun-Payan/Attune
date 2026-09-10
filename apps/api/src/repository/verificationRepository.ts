import { and, eq, gt, or } from "drizzle-orm";
import { db } from "@attune/db";
import { verificationCodes, type VerificationCodeRecord } from "@attune/db/schema";

export type VerificationType = "EMAIL_CHANGE" | "PASSWORD_RESET";

export interface CreateVerificationCodeInput {
  userId?: string;
  email: string;
  code: string;
  type: VerificationType;
  expiresInMinutes?: number;
}

export async function createVerificationCode(
  input: CreateVerificationCodeInput,
): Promise<VerificationCodeRecord> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 15) * 60 * 1000);

  // Clean up any existing active codes for this email and type or userId and type
  if (input.userId) {
    await db
      .delete(verificationCodes)
      .where(
        and(
          eq(verificationCodes.type, input.type),
          or(
            eq(verificationCodes.email, normalizedEmail),
            eq(verificationCodes.userId, input.userId),
          ),
        ),
      );
  } else {
    await db
      .delete(verificationCodes)
      .where(
        and(
          eq(verificationCodes.type, input.type),
          eq(verificationCodes.email, normalizedEmail),
        ),
      );
  }

  const [record] = await db
    .insert(verificationCodes)
    .values({
      userId: input.userId ?? null,
      email: normalizedEmail,
      code: input.code,
      type: input.type,
      expiresAt,
    })
    .returning();

  return record;
}

export async function findValidVerificationCode(input: {
  email: string;
  code: string;
  type: VerificationType;
  userId?: string;
}): Promise<VerificationCodeRecord | undefined> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const conditions = [
    eq(verificationCodes.email, normalizedEmail),
    eq(verificationCodes.code, input.code.trim()),
    eq(verificationCodes.type, input.type),
    gt(verificationCodes.expiresAt, new Date()),
  ];

  if (input.userId) {
    conditions.push(eq(verificationCodes.userId, input.userId));
  }

  const [record] = await db
    .select()
    .from(verificationCodes)
    .where(and(...conditions));

  return record;
}

export async function deleteVerificationCode(id: string): Promise<void> {
  await db.delete(verificationCodes).where(eq(verificationCodes.id, id));
}
