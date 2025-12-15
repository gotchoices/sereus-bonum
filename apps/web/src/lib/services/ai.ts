/**
 * AI Service
 * 
 * Client-side wrapper that calls our API routes
 * (API routes use Vercel AI SDK server-side to avoid CORS issues)
 */

import type { CoreMessage } from 'ai';
import { settings } from '$lib/stores/settings';
import { get } from 'svelte/store';

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIStreamResponse {
  textStream: ReadableStream<string>;
  fullText: Promise<string>;
}

/**
 * Validate AI settings
 */
function validateSettings() {
  const currentSettings = get(settings);
  const { provider, apiKey, enabled } = currentSettings.ai;
  
  if (!enabled) {
    throw new Error('AI assistant is not enabled. Please enable it in Settings.');
  }
  
  if (!provider) {
    throw new Error('No AI provider selected. Please select a provider in Settings.');
  }
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('No API key configured. Please add your API key in Settings.');
  }
  
  return { provider, apiKey };
}

/**
 * Generate a single AI response (non-streaming)
 */
export async function generateAIResponse(
  messages: CoreMessage[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
  }
): Promise<AIResponse> {
  try {
    const { provider, apiKey } = validateSettings();
    
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        apiKey,
        messages,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature ?? 0.7,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'AI request failed');
    }
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while contacting AI service.');
  }
}

/**
 * Generate a streaming AI response
 */
export async function streamAIResponse(
  messages: CoreMessage[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
  }
): Promise<AIStreamResponse> {
  try {
    const { provider, apiKey } = validateSettings();
    
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        apiKey,
        messages,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature ?? 0.7,
      }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'AI streaming request failed');
    }
    
    if (!response.body) {
      throw new Error('No response body received from server');
    }
    
    const textStream = response.body.pipeThrough(new TextDecoderStream());
    
    // Collect full text as stream progresses
    const fullText = (async () => {
      const reader = textStream.getReader();
      let fullText = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += value;
        }
      } finally {
        reader.releaseLock();
      }
      return fullText;
    })();
    
    return {
      textStream: textStream as unknown as ReadableStream<string>,
      fullText,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while contacting AI service.');
  }
}

/**
 * Test AI connection with a simple query
 */
export async function testAIConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await generateAIResponse(
      [{ role: 'user', content: 'Say "Hello from Sereus Bonum!" if you can read this.' }],
      { 
        systemPrompt: 'You are a helpful assistant. Respond concisely.',
        temperature: 0,
      }
    );
    
    return {
      success: true,
      message: `Connection successful! ${response.text}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

