import * as schema from '@db/schema';
import type { TNewOrganizationDepartment, TOrganizationDepartment } from '@db/types';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db } from '@db/drizzle';

export async function listOrganizationDepartments(
  orgId: string
): Promise<Array<TOrganizationDepartment & { employeeCount: number }>> {
  try {
    const rows = await db
      .select({
        id: schema.organizationDepartment.id,
        organizationId: schema.organizationDepartment.organizationId,
        name: schema.organizationDepartment.name,
        createdAt: schema.organizationDepartment.createdAt,
        updatedAt: schema.organizationDepartment.updatedAt,
        employeeCount: count(schema.organizationmember.id)
      })
      .from(schema.organizationDepartment)
      .leftJoin(
        schema.organizationmember,
        and(
          eq(schema.organizationmember.departmentId, schema.organizationDepartment.id),
          eq(schema.organizationmember.organizationId, orgId)
        )
      )
      .where(eq(schema.organizationDepartment.organizationId, orgId))
      .groupBy(
        schema.organizationDepartment.id,
        schema.organizationDepartment.organizationId,
        schema.organizationDepartment.name,
        schema.organizationDepartment.createdAt,
        schema.organizationDepartment.updatedAt
      )
      .orderBy(asc(schema.organizationDepartment.name));

    return rows.map((row) => ({
      ...row,
      employeeCount: Number(row.employeeCount ?? 0)
    }));
  } catch (error) {
    console.error('listOrganizationDepartments error:', error);
    throw new Error(
      `Failed to list organization departments: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getOrganizationDepartmentById(
  orgId: string,
  departmentId: number
): Promise<TOrganizationDepartment | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.organizationDepartment)
      .where(
        and(eq(schema.organizationDepartment.organizationId, orgId), eq(schema.organizationDepartment.id, departmentId))
      )
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getOrganizationDepartmentById error:', error);
    throw new Error(
      `Failed to get organization department: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getOrganizationDepartmentByName(
  orgId: string,
  name: string
): Promise<TOrganizationDepartment | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  try {
    const [row] = await db
      .select()
      .from(schema.organizationDepartment)
      .where(
        and(
          eq(schema.organizationDepartment.organizationId, orgId),
          sql`lower(trim(${schema.organizationDepartment.name})) = ${normalized}`
        )
      )
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getOrganizationDepartmentByName error:', error);
    throw new Error(
      `Failed to get organization department by name: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function createOrganizationDepartment(
  values: TNewOrganizationDepartment
): Promise<TOrganizationDepartment> {
  try {
    const [created] = await db.insert(schema.organizationDepartment).values(values).returning();
    return created;
  } catch (error) {
    console.error('createOrganizationDepartment error:', error);
    throw new Error(
      `Failed to create organization department: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function updateOrganizationDepartment(
  orgId: string,
  departmentId: number,
  data: { name: string }
): Promise<TOrganizationDepartment | null> {
  try {
    const [updated] = await db
      .update(schema.organizationDepartment)
      .set({ name: data.name, updatedAt: new Date().toISOString() })
      .where(
        and(eq(schema.organizationDepartment.organizationId, orgId), eq(schema.organizationDepartment.id, departmentId))
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('updateOrganizationDepartment error:', error);
    throw new Error(
      `Failed to update organization department: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function countMembersUsingDepartment(orgId: string, departmentId: number): Promise<number> {
  try {
    const [row] = await db
      .select({ count: count(schema.organizationmember.id) })
      .from(schema.organizationmember)
      .where(
        and(
          eq(schema.organizationmember.organizationId, orgId),
          eq(schema.organizationmember.departmentId, departmentId)
        )
      );

    return Number(row?.count ?? 0);
  } catch (error) {
    console.error('countMembersUsingDepartment error:', error);
    throw new Error(
      `Failed to count members using department: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function deleteOrganizationDepartment(orgId: string, departmentId: number): Promise<boolean> {
  try {
    const deleted = await db
      .delete(schema.organizationDepartment)
      .where(
        and(eq(schema.organizationDepartment.organizationId, orgId), eq(schema.organizationDepartment.id, departmentId))
      )
      .returning({ id: schema.organizationDepartment.id });

    return deleted.length > 0;
  } catch (error) {
    console.error('deleteOrganizationDepartment error:', error);
    throw new Error(
      `Failed to delete organization department: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
