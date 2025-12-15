/**
 * AI Service
 * 
 * Direct browser integration with AI providers
 * Uses dangerouslyAllowBrowser flag since users supply their own API keys
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText, type CoreMessage } from 'ai';
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
 * Get configured AI provider client
 */
function getProviderClient() {
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
  
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey });
    case 'anthropic':
      return createAnthropic({ 
        apiKey,
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      });
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get the default model for the current provider
 */
function getDefaultModel() {
  const currentSettings = get(settings);
  const { provider } = currentSettings.ai;
  
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-sonnet-4-0'; // Latest Claude Sonnet
    case 'google':
      return 'gemini-1.5-pro';
    default:
      return 'gpt-4o';
  }
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
    const provider = getProviderClient();
    const model = getDefaultModel();
    
    const result = await generateText({
      model: provider(model),
      messages,
      system: options?.systemPrompt,
      temperature: options?.temperature ?? 0.7,
    });
    
    return {
      text: result.text,
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens || 0,
        completionTokens: result.usage.outputTokens || 0,
        totalTokens: result.usage.totalTokens || 0,
      } : undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Enhanced error messages
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        throw new Error('Invalid API key. Please check your API key in Settings.');
      }
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later or check your quota.');
      }
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
    const provider = getProviderClient();
    const model = getDefaultModel();
    
    const result = await streamText({
      model: provider(model),
      messages,
      system: options?.systemPrompt,
      temperature: options?.temperature ?? 0.7,
    });
    
    return {
      textStream: result.textStream,
      fullText: result.text,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        throw new Error('Invalid API key. Please check your API key in Settings.');
      }
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later or check your quota.');
      }
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
    console.error('[AI Test] Full error:', error);
    if (error instanceof Error) {
      console.error('[AI Test] Error message:', error.message);
      console.error('[AI Test] Error stack:', error.stack);
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : JSON.stringify(error),
    };
  }
}

