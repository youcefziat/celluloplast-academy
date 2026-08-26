import { env } from '../config/env';

export const EMAIL_IDS = [
  'forgotPassword',
  'inviteTeacher',
  'newsfeedComment',
  'newsfeedPost',
  'onPasswordReset',
  'cohortGoalReminder',
  'quizAssigned',
  'sessionReminder',
  'sessionUpdated',
  'submissionGraded',
  'submissionReceived',
  'studentLimitReached',
  'studentLimitApproaching',
  'studentCourseInvite',
  'studentCourseCompletion',
  'studentCourseWelcome',
  'studentOrgInvite',
  'studentCohortWelcome',
  'studentProvePayment',
  'teacherCourseWelcome',
  'teacherStudentBuyRequest',
  'teacherStudentJoined',
  'verifyEmail',
  'welcome'
] as const;

import { EMAIL_APP_NAME } from '../celluloplast-brand';

const DEFAULT_EMAIL_FROM = `"${EMAIL_APP_NAME}" <notify@mail.classroomio.com>`;

export const EMAIL_FROM = env.SMTP_SENDER || DEFAULT_EMAIL_FROM;
export const EMAIL_REPLY_TO = `"${EMAIL_APP_NAME}" <help@classroomio.com>`;
