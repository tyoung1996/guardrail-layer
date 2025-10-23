// src/prisma/client.ts
import { initializeGuardrailsDB } from '../initGuardrailsDB.js';

export const prisma = await initializeGuardrailsDB();