export enum ROUTE_NAME {
  COURSE = 'COURSE',
  COURSE_SETTINGS = 'COURSE_SETTINGS',
  COURSE_CERTIFICATE = 'COURSE_CERTIFICATE'
}

export const ROUTE_PATHS = {
  [ROUTE_NAME.COURSE]: '/courses/[id]',
  [ROUTE_NAME.COURSE_SETTINGS]: '/courses/[id]/settings',
  [ROUTE_NAME.COURSE_CERTIFICATE]: '/courses/[id]/certificates'
} as const;

export const ROUTE_SECTIONS = {
  [ROUTE_NAME.COURSE_SETTINGS]: {
    PUBLISH: 'publish',
    COMPLETION_DEADLINE: 'course-completion-deadline'
  },

  [ROUTE_NAME.COURSE_CERTIFICATE]: {
    THRESHOLD: 'cert-threshold',
    CERT_DEADLINE: 'cert-deadline',
    CERT_EMAIL_MESSAGE: 'cert-email-message'
  }
} as const;

export type SectionsFor<R extends ROUTE_NAME> = R extends keyof typeof ROUTE_SECTIONS
  ? (typeof ROUTE_SECTIONS)[R][keyof (typeof ROUTE_SECTIONS)[R]]
  : never;

export type ExtractParams<T extends string> = T extends `${string}[${infer Param}]${infer Rest}`
  ? Param | ExtractParams<Rest>
  : never;

export type RouteValues<R extends ROUTE_NAME> = Record<ExtractParams<(typeof ROUTE_PATHS)[R]>, string> &
  Record<string, string | undefined>;
