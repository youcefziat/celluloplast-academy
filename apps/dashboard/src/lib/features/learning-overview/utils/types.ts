import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type LearningOverviewRequest = (typeof classroomio.dash)['learning-overview']['$get'];

export type LearningOverviewSuccess = Extract<InferResponseType<LearningOverviewRequest>, { success: true }>;

export type LearningOverviewData = LearningOverviewSuccess['data'];

export type LearningOverviewLearner = LearningOverviewData['learners'][number];

export type LearningOverviewCourse = LearningOverviewData['courses'][number];

export type LearningProgressStatus = LearningOverviewLearner['status'];
