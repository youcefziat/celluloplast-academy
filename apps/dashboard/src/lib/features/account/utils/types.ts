import { classroomio } from '$lib/utils/services/api';

export type ViewAsStudentTokenRequest = (typeof classroomio.account)['view-as-student-token']['$post'];
