import type { OrganizationAudienceQuery, OrganizationAudienceRequestQuery } from './types';

export const DEFAULT_ORG_AUDIENCE_QUERY: OrganizationAudienceQuery = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

export function getAudienceQueryFromSearchParams(
  searchParams: URLSearchParams,
  defaults: OrganizationAudienceQuery = DEFAULT_ORG_AUDIENCE_QUERY
): OrganizationAudienceQuery {
  const page = Number(searchParams.get('page'));
  const limit = Number(searchParams.get('limit'));
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder');
  const search = searchParams.get('search')?.trim() || undefined;

  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : defaults.page,
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : defaults.limit,
    sortBy:
      sortBy === 'name' || sortBy === 'email' || sortBy === 'createdAt' || sortBy === 'role' ? sortBy : defaults.sortBy,
    sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : defaults.sortOrder,
    search,
    roleId: readRoleId(searchParams.get('roleId')),
    status: readStatus(searchParams.get('status'))
  };
}

/** Only the three known roles survive the round trip; anything else clears the filter. */
function readRoleId(raw: string | null): number | undefined {
  const roleId = Number(raw);

  return roleId === 1 || roleId === 2 || roleId === 3 ? roleId : undefined;
}

function readStatus(raw: string | null): 'active' | 'pending' | undefined {
  return raw === 'active' || raw === 'pending' ? raw : undefined;
}

export function getAudienceSearchParams(query: OrganizationAudienceQuery): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set('page', String(query.page));
  searchParams.set('limit', String(query.limit));
  searchParams.set('sortBy', query.sortBy);
  searchParams.set('sortOrder', query.sortOrder);

  if (query.search) {
    searchParams.set('search', query.search);
  }

  if (query.roleId) {
    searchParams.set('roleId', String(query.roleId));
  }

  if (query.status) {
    searchParams.set('status', query.status);
  }

  return searchParams;
}

export function toAudienceRequestQuery(
  query?: Partial<OrganizationAudienceQuery>
): OrganizationAudienceRequestQuery | undefined {
  if (!query) {
    return undefined;
  }

  return {
    page: query.page != null ? String(query.page) : undefined,
    limit: query.limit != null ? String(query.limit) : undefined,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    roleIds: query.roleId != null ? String(query.roleId) : undefined,
    status: query.status
  };
}
