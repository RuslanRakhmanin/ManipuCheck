// Core data types
export interface ExtractedContent {
  title: string;
  content: string;
  htmlContent: string;
  wordCount: number;
  url: string;
  extractedAt: string;
}

export interface ManipulationBlock {
  original_text: string;
  manipulation_type: ManipulationType;
  manipulation_description: string;
  confidence: number;
}

export interface ManipulationAnalysis {
  manipulations: ManipulationBlock[];
  analysisDate: string;
  provider: string;
  model: string;
}

// Manipulation taxonomy
export type ManipulationType = 
  // Emotional Manipulation
  | 'fear_mongering'
  | 'outrage_bait'
  | 'emotional_appeal'
  // Logical Fallacies
  | 'strawman'
  | 'ad_hominem'
  | 'false_dichotomy'
  | 'slippery_slope'
  // Information Distortion
  | 'cherry_picking'
  | 'misleading_statistics'
  | 'false_correlation'
  | 'quote_mining'
  // Persuasion Techniques
  | 'bandwagon'
  | 'authority_appeal'
  | 'loaded_language'
  | 'repetition'
  // Structural Manipulation
  | 'headline_mismatch'
  | 'buried_lede'
  | 'false_balance';

export const MANIPULATION_TYPES: ManipulationType[] = [
  'fear_mongering', 'outrage_bait', 'emotional_appeal',
  'strawman', 'ad_hominem', 'false_dichotomy', 'slippery_slope',
  'cherry_picking', 'misleading_statistics', 'false_correlation', 'quote_mining',
  'bandwagon', 'authority_appeal', 'loaded_language', 'repetition',
  'headline_mismatch', 'buried_lede', 'false_balance'
];

// Configuration types
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

export type LLMProvider = 'gemini';

export interface UserSettings {
  provider: LLMProvider;
  model: string;
  language: string;
  highlightMode: HighlightMode;
  autoAnalyze: boolean;
}

export type HighlightMode = 'full-color' | 'low-contrast';

// Analysis states
export interface AnalysisStatus {
  state: AnalysisState;
  progress?: number;
  error?: string;
  lastAnalysis?: ManipulationAnalysis;
}

export type AnalysisState = 'idle' | 'analyzing' | 'complete' | 'error';

// Message passing
export enum MessageType {
  ANALYZE_PAGE = 'ANALYZE_PAGE',
  ANALYZE_SELECTION = 'ANALYZE_SELECTION',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',
  GET_ANALYSIS_STATUS = 'GET_ANALYSIS_STATUS',
  CLEAR_HIGHLIGHTS = 'CLEAR_HIGHLIGHTS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS'
}

export interface Message {
  type: MessageType;
  payload?: any;
  tabId?: number;
  timestamp: number;
}

// UI component props
export interface AnalysisResult {
  manipulations: ManipulationBlock[];
  totalCount: number;
  byCategory: Record<string, number>;
  analysisDate: string;
}

// Error types
export class AnalysisError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'AnalysisError';
  }
}