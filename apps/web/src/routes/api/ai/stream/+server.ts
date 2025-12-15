/**
 * AI Streaming API Route
 * 
 * Server-side proxy for streaming AI responses
 */

import type { RequestHandler } from './$types';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type CoreMessage } from 'ai';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      provider, 
      apiKey, 
      messages, 
      systemPrompt, 
      temperature = 0.7 
    } = body as {
      provider: 'openai' | 'anthropic' | 'google';
      apiKey: string;
      messages: CoreMessage[];
      systemPrompt?: string;
      temperature?: number;
    };

    // Validate inputs
    if (!provider || !apiKey || !messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: provider, apiKey, messages' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get provider client
    let providerClient;
    let model: string;
    
    switch (provider) {
      case 'openai':
        providerClient = createOpenAI({ apiKey });
        model = 'gpt-4o';
        break;
      case 'anthropic':
        providerClient = createAnthropic({ apiKey });
        model = 'claude-3-5-sonnet-20241022';
        break;
      case 'google':
        providerClient = createGoogleGenerativeAI({ apiKey });
        model = 'gemini-1.5-pro';
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Generate streaming response
    const result = await streamText({
      model: providerClient(model),
      messages,
      system: systemPrompt,
      temperature,
    });

    // Return the text stream directly
    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('AI streaming error:', error);
    
    // Enhanced error messages
    let errorMessage = 'Unknown error occurred while contacting AI service.';
    
    if (error?.message) {
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        errorMessage = 'Invalid API key. Please check your API key in Settings.';
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorMessage = 'API rate limit exceeded. Please try again later or check your quota.';
      } else if (error.message.includes('model')) {
        errorMessage = 'Model not available or not accessible with your API key.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: error.status || 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

