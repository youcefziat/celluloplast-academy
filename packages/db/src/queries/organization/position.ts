import * as schema from '@db/schema';
import type { TNewOrganizationPosition, TOrganizationPosition } from '@db/types';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db } from '@db/drizzle';

export async function listOrganizationPositions(
  orgId: string
): Promise<Array<TOrganizationPosition & { employeeCount: number }>> {
  try {
    const rows = await db
      .select({
        id: schema.organizationPosition.id,
        organizationId: schema.organizationPosition.organizationId,
        name: schema.organizationPosition.name,
        createdAt: schema.organizationPosition.createdAt,
        updatedAt: schema.organizationPosition.updatedAt,
        employeeCount: count(schema.organizationmember.id)
      })
      .from(schema.organizationPosition)
      .leftJoin(
        schema.organizationmember,
        and(
          eq(schema.organizationmember.positionId, schema.organizationPosition.id),
          eq(schema.organizationmember.organizationId, orgId)
        )
      )
      .where(eq(schema.organizationPosition.organizationId, orgId))
      .groupBy(
        schema.organizationPosition.id,
        schema.organizationPosition.organizationId,
        schema.organizationPosition.name,
        schema.organizationPosition.createdAt,
        schema.organizationPosition.updatedAt
      )
      .orderBy(asc(schema.organizationPosition.name));

    return rows.map((row) => ({
      ...row,
      employeeCount: Number(row.employeeCount ?? 0)
    }));
  } catch (error) {
    console.error('listOrganizationPositions error:', error);
    throw new Error(
      `Failed to list organization positions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getOrganizationPositionById(
  orgId: string,
  positionId: number
): Promise<TOrganizationPosition | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.organizationPosition)
      .where(and(eq(schema.organizationPosition.organizationId, orgId), eq(schema.organizationPosition.id, positionId)))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getOrganizationPositionById error:', error);
    throw new Error(`Failed to get organization position: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getOrganizationPositionByName(
  orgId: string,
  name: string
): Promise<TOrganizationPosition | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  try {
    const [row] = await db
      .select()
      .from(schema.organizationPosition)
      .where(
        and(
          eq(schema.organizationPosition.organizationId, orgId),
          sql`lower(trim(${schema.organizationPosition.name})) = ${normalized}`
        )
      )
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getOrganizationPositionByName error:', error);
    throw new Error(
      `Failed to get organization position by name: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function createOrganizationPosition(values: TNewOrganizationPosition): Promise<TOrganizationPosition> {
  try {
    const [created] = await db.insert(schema.organizationPosition).values(values).returning();
    return created;
  } catch (error) {
    console.error('createOrganizationPosition error:', error);
    throw new Error(
      `Failed to create organization position: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function updateOrganizationPosition(
  orgId: string,
  positionId: number,
  data: { name: string }
): Promise<TOrganizationPosition | null> {
  try {
    const [updated] = await db
      .update(schema.organizationPosition)
      .set({ name: data.name, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.organizationPosition.organizationId, orgId), eq(schema.organizationPosition.id, positionId)))
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('updateOrganizationPosition error:', error);
    throw new Error(
      `Failed to update organization position: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function countMembersUsingPosition(orgId: string, positionId: number): Promise<number> {
  try {
    const [row] = await db
      .select({ count: count(schema.organizationmember.id) })
      .from(schema.organizationmember)
      .where(
        and(eq(schema.organizationmember.organizationId, orgId), eq(schema.organizationmember.positionId, positionId))
      );

    return Number(row?.count ?? 0);
  } catch (error) {
    console.error('countMembersUsingPosition error:', error);
    throw new Error(
      `Failed to count members using position: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function deleteOrganizationPosition(orgId: string, positionId: number): Promise<boolean> {
  try {
    const deleted = await db
      .delete(schema.organizationPosition)
      .where(and(eq(schema.organizationPosition.organizationId, orgId), eq(schema.organizationPosition.id, positionId)))
      .returning({ id: schema.organizationPosition.id });

    return deleted.length > 0;
  } catch (error) {
    console.error('deleteOrganizationPosition error:', error);
    throw new Error(
      `Failed to delete organization position: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
