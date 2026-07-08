import type { NextAction, Workflow } from './types';

const ROUTE_MAP: Record<NextAction, Workflow> = {
  START_DIAGNOSIS: 'DIAGNOSIS',
  CONTINUE_DIAGNOSIS: 'DIAGNOSIS',
  ANSWER_FOLLOWUP: 'FOLLOW_UP',
  ANSWER_GENERAL_QA: 'GENERAL_QA',
  ASK_CLARIFICATION: 'DIAGNOSIS',
};

export class WorkflowRouter {
  route(nextAction: NextAction): Workflow {
    return ROUTE_MAP[nextAction];
  }
}

export const workflowRouter = new WorkflowRouter();
