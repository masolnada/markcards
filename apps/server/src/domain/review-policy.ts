export interface ReviewPolicy {
  maxNewPerDay: number;
  learningSteps: number[];   // minutes
  relearningSteps: number[]; // minutes
}

export const DEFAULT_POLICY: ReviewPolicy = {
  maxNewPerDay: 20,
  learningSteps: [1, 10],
  relearningSteps: [10],
};
