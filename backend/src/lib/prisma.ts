import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';

export function createPrismaClient(connectionString: string = env.DATABASE_URL): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = createPrismaClient();

/** Either the root client or an interactive transaction client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;
