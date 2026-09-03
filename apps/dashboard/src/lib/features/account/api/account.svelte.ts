import type { ViewAsStudentTokenRequest } from '../utils/types';
import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

/**
 * Account-scoped calls that are not tied to a single organization.
 *
 * Celluloplast Academy is single-tenant, so upstream's workspace management (list / create /
 * delete) is gone; what remains is the short-lived token behind the tutor "view as student"
 * handoff.
 */
class AccountApi extends BaseApiWithErrors {
  /**
   * Mints a short-lived login-link token for the current user.
   * Returns the token, or undefined on failure.
   */
  async createViewAsStudentToken(): Promise<string | undefined> {
    const result = await this.execute<ViewAsStudentTokenRequest>({
      requestFn: () => classroomio.account['view-as-student-token'].$post(),
      logContext: 'creating view-as-student token'
    });

    return result?.data.token;
  }
}

export const accountApi = new AccountApi();
