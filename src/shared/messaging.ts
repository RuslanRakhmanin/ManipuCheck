import { Message, MessageType } from './types';

// Simple messaging functions
export async function sendMessage(message: Omit<Message, 'timestamp'>): Promise<any> {
  const fullMessage: Message = {
    ...message,
    timestamp: Date.now()
  };
  
  try {
    return await chrome.runtime.sendMessage(fullMessage);
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

export async function sendMessageToTab(tabId: number, message: Omit<Message, 'timestamp' | 'tabId'>): Promise<any> {
  const fullMessage: Message = {
    ...message,
    tabId,
    timestamp: Date.now()
  };
  
  try {
    return await chrome.tabs.sendMessage(tabId, fullMessage);
  } catch (error) {
    console.error('Failed to send message to tab:', error);
    throw error;
  }
}

export function onMessage(callback: (message: Message, sender?: chrome.runtime.MessageSender, sendResponse?: (response?: any) => void) => void | boolean | Promise<boolean>): void {
  chrome.runtime.onMessage.addListener(callback);
}

export class MessageHandler {
  static async sendMessage(message: Omit<Message, 'timestamp'>): Promise<any> {
    return sendMessage(message);
  }

  static async sendMessageToTab(tabId: number, message: Omit<Message, 'timestamp' | 'tabId'>): Promise<any> {
    return sendMessageToTab(tabId, message);
  }

  static onMessage(callback: (message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void | boolean): void {
    chrome.runtime.onMessage.addListener(callback);
  }
}

// Specific message creators
export const Messages = {
  analyzePage: (content?: string) => ({
    type: MessageType.ANALYZE_PAGE,
    payload: { content }
  }),

  analyzeSelection: (selectedText: string) => ({
    type: MessageType.ANALYZE_SELECTION,
    payload: { selectedText }
  }),

  getAnalysisStatus: () => ({
    type: MessageType.GET_ANALYSIS_STATUS
  }),

  clearHighlights: () => ({
    type: MessageType.CLEAR_HIGHLIGHTS
  }),

  updateSettings: (settings: any) => ({
    type: MessageType.UPDATE_SETTINGS,
    payload: settings
  }),

  analysisComplete: (analysis: any) => ({
    type: MessageType.ANALYSIS_COMPLETE,
    payload: analysis
  }),

  analysisError: (error: string) => ({
    type: MessageType.ANALYSIS_ERROR,
    payload: { error }
  })
};