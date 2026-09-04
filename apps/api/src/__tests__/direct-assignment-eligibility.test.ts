import { describe, expect, it } from 'vitest';

import { resolveDirectAssignment } from '../services/course/audience-rules';
import type { TCourseAudienceAssignment } from '@cio/utils/validation/course/course';

const productionWelder = { memberId: 10, jobTitle: 'Welder', department: 'Production' };

function assignment(value: Partial<TCourseAudienceAssignment>): TCourseAudienceAssignment {
  return value as TCourseAudienceAssignment;
}

describe('resolveDirectAssignment', () => {
  it('allows a course open to everyone', () => {
    expect(resolveDirectAssignment(productionWelder, assignment({ mode: 'all' }))).toBe('allowed');
  });

  it('allows a department course to someone in that department', () => {
    const course = assignment({ mode: 'departments', departments: ['Production'] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('allowed');
  });

  it('refuses a department course to someone outside it', () => {
    const course = assignment({ mode: 'departments', departments: ['Quality'] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('refused');
  });

  it('allows a job-title course to a matching job title, ignoring case and spacing', () => {
    const course = assignment({ mode: 'jobTitles', jobTitles: ['  welder '] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('allowed');
  });

  it('refuses a job-title course to a different job title', () => {
    const course = assignment({ mode: 'jobTitles', jobTitles: ['Operator'] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('refused');
  });

  it('refuses a rule-based course when the member has no department or job title at all', () => {
    const newcomer = { memberId: 11, jobTitle: null, department: null };

    expect(resolveDirectAssignment(newcomer, assignment({ mode: 'departments', departments: ['Production'] }))).toBe(
      'refused'
    );
    expect(resolveDirectAssignment(newcomer, assignment({ mode: 'jobTitles', jobTitles: ['Welder'] }))).toBe('refused');
  });

  it('allows a per-employee course when the member is already on the list', () => {
    const course = assignment({ mode: 'members', memberIds: [10, 20] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('allowed');
  });

  it('adds the member to the list when the course targets named people', () => {
    // This is the per-employee lane: the grant belongs in the rule, not beside it.
    const course = assignment({ mode: 'members', memberIds: [20] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('addToMemberList');
  });

  it('adds to an empty member list rather than refusing', () => {
    const course = assignment({ mode: 'members', memberIds: [] });

    expect(resolveDirectAssignment(productionWelder, course)).toBe('addToMemberList');
  });
});
