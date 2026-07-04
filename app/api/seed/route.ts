import { NextRequest } from 'next/server';
import { seedDatabase } from '@/lib/db/seed';
import { successResponse, errorResponse } from '@/utils/response';

/**
 * POST /api/seed
 *
 * Seeds the database with initial crops and diseases.
 * Idempotent — will not insert data if collections are non-empty.
 *
 * Response:
 *   { success: true, data: { cropsSeeded: number, diseasesSeeded: number } }
 */
export async function POST(_request: NextRequest) {
  try {
    const result = await seedDatabase();
    return successResponse(result, 'Database seeded successfully');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    return errorResponse('Failed to seed database');
  }
}
