export interface ReviewPolicy {
  learningSteps: number[];   // minutes
  relearningSteps: number[]; // minutes
}

export const DEFAULT_POLICY: ReviewPolicy = {
  learningSteps: [1, 10],
  relearningSteps: [10],
};
