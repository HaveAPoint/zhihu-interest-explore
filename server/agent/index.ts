// Agent interface - stable function signatures
// Teammates implement real versions; author provides mock in T05

import type {
  ClassifyInput,
  ClassifyOutput,
  GenerateRootInput,
  GenerateRootOutput,
  GenerateFollowupInput,
  GenerateFollowupOutput,
} from './types.js';
import { MockAgentProvider } from './mock.js';
import type { MockScenario } from '@zhihu-explore/fixtures';

export type {
  ClassifyInput,
  ClassifyOutput,
  GenerateRootInput,
  GenerateRootOutput,
  GenerateFollowupInput,
  GenerateFollowupOutput,
};

export interface AgentProvider {
  classifyArticle(input: ClassifyInput): Promise<ClassifyOutput>;
  generateRoot(input: GenerateRootInput): Promise<GenerateRootOutput>;
  generateFollowup(input: GenerateFollowupInput): Promise<GenerateFollowupOutput>;
}

export { MockAgentProvider };

let currentProvider: AgentProvider = new MockAgentProvider();

export function setAgentProvider(provider: AgentProvider) {
  currentProvider = provider;
}

export function setMockScenario(scenario: MockScenario, delayMs: number = 0) {
  currentProvider = new MockAgentProvider(scenario, delayMs);
}

export async function classifyArticle(input: ClassifyInput): Promise<ClassifyOutput> {
  return currentProvider.classifyArticle(input);
}

export async function generateRoot(input: GenerateRootInput): Promise<GenerateRootOutput> {
  return currentProvider.generateRoot(input);
}

export async function generateFollowup(input: GenerateFollowupInput): Promise<GenerateFollowupOutput> {
  return currentProvider.generateFollowup(input);
}
