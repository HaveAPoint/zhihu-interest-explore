// Agent types - shared between mock and live implementations

export type DisciplineSlug = 'agent-app-dev' | 'cognitive-psychology' | 'distributed-systems';

export interface ClassifyInput {
  title: string;
  tags: string[];
  lead: string;
}

export interface ClassifyOutput {
  slug: DisciplineSlug | null;
}

export interface ArticleContext {
  title: string;
  tags: string[];
  url: string;
  content_text: string;
}

export interface TreeContext {
  nodes: TreeNodeContext[];
}

export interface TreeNodeContext {
  id: string;
  parent_id: string | null;
  title: string;
  highlight_text: string;
  question_text: string;
  answer_extra: string;
  is_current: boolean;
}

export interface SkeletonNode {
  id: string;
  parent_id: string | null;
  title: string;
  aliases: string[];
  definition: string;
}

export interface GenerateRootInput {
  article: ArticleContext;
  tree: TreeContext;
  highlight: string;
  question: string;
  historySummary: string;
  disciplineSkeleton: SkeletonNode[];
}

export interface Candidate {
  node_id: string;
  degree: 'exact' | 'broader' | 'related';
  reason: string;
}

export interface Source {
  title: string;
  url: string;
}

export interface GenerateRootOutput {
  title: string;
  extra: string;
  sources: Source[];
  candidates: Candidate[];
}

export interface GenerateFollowupInput {
  article: ArticleContext;
  tree: TreeContext;
  highlight: string;
  question: string;
}

export interface GenerateFollowupOutput {
  title: string;
  extra: string;
  sources: Source[];
}
