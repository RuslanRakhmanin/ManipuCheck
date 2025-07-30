import { UserSettings, ManipulationType } from './types';

export const DEFAULT_SETTINGS: UserSettings = {
  provider: 'gemini',
  model: 'gemini-pro',
  language: 'en',
  highlightMode: 'full-color',
  autoAnalyze: false
};

export const MANIPULATION_COLORS: Record<ManipulationType, string> = {
  // Emotional Manipulation - Red tones
  fear_mongering: '#FF6B6B',
  outrage_bait: '#FF6B6B',
  emotional_appeal: '#FF6B6B',
  
  // Logical Fallacies - Orange tones
  strawman: '#FFB347',
  ad_hominem: '#FFB347',
  false_dichotomy: '#FFB347',
  slippery_slope: '#FFB347',
  
  // Information Distortion - Yellow tones
  cherry_picking: '#FFD93D',
  misleading_statistics: '#FFD93D',
  false_correlation: '#FFD93D',
  quote_mining: '#FFD93D',
  
  // Persuasion Techniques - Blue tones
  bandwagon: '#6BCEFF',
  authority_appeal: '#6BCEFF',
  loaded_language: '#6BCEFF',
  repetition: '#6BCEFF',
  
  // Structural Manipulation - Purple tones
  headline_mismatch: '#B19CD9',
  buried_lede: '#B19CD9',
  false_balance: '#B19CD9'
};

export const MANIPULATION_CATEGORIES = {
  'Emotional Manipulation': ['fear_mongering', 'outrage_bait', 'emotional_appeal'],
  'Logical Fallacies': ['strawman', 'ad_hominem', 'false_dichotomy', 'slippery_slope'],
  'Information Distortion': ['cherry_picking', 'misleading_statistics', 'false_correlation', 'quote_mining'],
  'Persuasion Techniques': ['bandwagon', 'authority_appeal', 'loaded_language', 'repetition'],
  'Structural Manipulation': ['headline_mismatch', 'buried_lede', 'false_balance']
};

export const ERROR_MESSAGES = {
  API_KEY_MISSING: 'Please add your API key in the settings.',
  API_KEY_INVALID: 'API key appears to be invalid. Please check your settings.',
  NETWORK_ERROR: 'Unable to connect to the analysis service. Please check your internet connection.',
  CONTENT_EXTRACTION_FAILED: 'Could not extract content from this page. Try selecting specific text instead.',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please wait a moment before trying again.',
  UNSUPPORTED_SITE: 'This website type is not fully supported. Try selecting specific text to analyze.',
  ANALYSIS_FAILED: 'Analysis failed. Please try again or check your settings.'
};

export const GEMINI_MODELS = [
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' }
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' }
];