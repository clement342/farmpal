import { describe, it, expect } from 'vitest';
import { WorkflowRouter } from '@/services/conversation/WorkflowRouter';

describe('WorkflowRouter', () => {
  const router = new WorkflowRouter();

  it('routes START_DIAGNOSIS to DIAGNOSIS', () => {
    expect(router.route('START_DIAGNOSIS')).toBe('DIAGNOSIS');
  });

  it('routes CONTINUE_DIAGNOSIS to DIAGNOSIS', () => {
    expect(router.route('CONTINUE_DIAGNOSIS')).toBe('DIAGNOSIS');
  });

  it('routes ANSWER_FOLLOWUP to FOLLOW_UP', () => {
    expect(router.route('ANSWER_FOLLOWUP')).toBe('FOLLOW_UP');
  });

  it('routes ANSWER_GENERAL_QA to GENERAL_QA', () => {
    expect(router.route('ANSWER_GENERAL_QA')).toBe('GENERAL_QA');
  });

  it('routes ASK_CLARIFICATION to DIAGNOSIS', () => {
    expect(router.route('ASK_CLARIFICATION')).toBe('DIAGNOSIS');
  });
});
