// Mock Agent implementation - used until teammates deliver real agent
// Returns deterministic results based on input and configured scenario

import type {
  AgentProvider,
  ClassifyInput,
  ClassifyOutput,
  GenerateRootInput,
  GenerateRootOutput,
  GenerateFollowupInput,
  GenerateFollowupOutput,
} from './index.js';
import {
  buildMockClassify,
  buildMockGenerateRoot,
  buildMockGenerateFollowup,
  type MockScenario,
} from '@zhihu-explore/fixtures';

export class MockAgentProvider implements AgentProvider {
  private scenario: MockScenario;
  private delayMs: number;

  constructor(scenario: MockScenario = 'default', delayMs: number = 0) {
    this.scenario = scenario;
    this.delayMs = delayMs;
  }

  setScenario(scenario: MockScenario) {
    this.scenario = scenario;
  }

  setDelay(ms: number) {
    this.delayMs = ms;
  }

  private async maybeDelay(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  async classifyArticle(input: ClassifyInput): Promise<ClassifyOutput> {
    await this.maybeDelay();
    return buildMockClassify(input, { scenario: this.scenario });
  }

  async generateRoot(input: GenerateRootInput): Promise<GenerateRootOutput> {
    await this.maybeDelay();
    return buildMockGenerateRoot(input, { scenario: this.scenario });
  }

  async generateFollowup(input: GenerateFollowupInput): Promise<GenerateFollowupOutput> {
    await this.maybeDelay();
    return buildMockGenerateFollowup(input, { scenario: this.scenario });
  }
}
