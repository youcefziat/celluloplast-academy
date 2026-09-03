import { ContentType } from '@cio/utils/constants/content';
import type { Course, CourseContentItem } from './types';
import { getCourseContent } from './content';

export type StudentContentLockReason = 'teacher_locked' | 'progression_locked';

export type LockedContentItem = { id: string; type: ContentType.Lesson | ContentType.Exercise };

function findContentItem(
  course: Course | null,
  contentId: string,
  contentType: typeof ContentType.Lesson | typeof ContentType.Exercise
): CourseContentItem | undefined {
  const content = getCourseContent(course);
  const items = content.grouped ? content.sections.flatMap((section) => section.items) : content.items;

  return items.find((item) => item.id === contentId && item.type === contentType);
}

/** Why a learner cannot open this lesson/exercise yet, or null when it is available. */
export function getStudentContentLockReason(
  course: Course | null,
  contentId: string | undefined,
  contentType: typeof ContentType.Lesson | typeof ContentType.Exercise | null
): StudentContentLockReason | null {
  if (!contentId || !contentType) {
    return null;
  }

  const item = findContentItem(course, contentId, contentType);

  if (!item) {
    return null;
  }

  if ((item.isUnlocked ?? true) === false) {
    return 'teacher_locked';
  }

  if (item.accessible === false) {
    return 'progression_locked';
  }

  return null;
}

export function isCourseContentLockedForStudent(
  course: Course | null,
  contentId: string | undefined,
  contentType: typeof ContentType.Lesson | typeof ContentType.Exercise | null
): boolean {
  return getStudentContentLockReason(course, contentId, contentType) !== null;
}

export function collectLockedContentItems(course: Course | null): LockedContentItem[] {
  const content = getCourseContent(course);

  const items = content.grouped ? content.sections.flatMap((section) => section.items) : content.items;

  return items
    .filter((item) => (item.isUnlocked ?? true) === false)
    .map((item) => ({
      id: item.id,
      type: item.type === ContentType.Exercise ? ContentType.Exercise : ContentType.Lesson
    }));
}

export function getStudentContentLockTitleKey(reason: StudentContentLockReason): string {
  if (reason === 'progression_locked') {
    return 'course.navItem.lessons.content_progression_locked_title';
  }

  return 'course.navItem.lessons.content_locked_title';
}

export function getStudentContentLockDescriptionKey(
  reason: StudentContentLockReason,
  contentType: typeof ContentType.Lesson | typeof ContentType.Exercise
): string {
  if (reason === 'progression_locked') {
    if (contentType === ContentType.Exercise) {
      return 'course.navItem.lessons.content_progression_locked_description_exercise';
    }

    return 'course.navItem.lessons.content_progression_locked_description_lesson';
  }

  return 'course.navItem.lessons.content_locked_description';
}
