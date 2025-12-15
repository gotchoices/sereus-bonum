<!--
  AI Assistant Component
  
  A conversational AI sidebar that helps users with accounting concepts,
  setup workflows, and general questions.
-->

<script lang="ts">
  import { streamAIResponse } from '$lib/services/ai';
  import { settings } from '$lib/stores/settings';
  import type { CoreMessage } from 'ai';
  
  // Props
  let { 
    isOpen = $bindable(false),
  }: {
    isOpen?: boolean;
  } = $props();
  
  // State
  let messages = $state<CoreMessage[]>([]);
  let inputText = $state('');
  let isStreaming = $state(false);
  let currentStreamingMessage = $state('');
  let messagesContainer: HTMLDivElement | null = $state(null);
  let inputElement: HTMLTextAreaElement | null = $state(null);
  
  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    if (messages.length > 0 || currentStreamingMessage) {
      messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    }
  });
  
  // Focus input when opened
  $effect(() => {
    if (isOpen) {
      setTimeout(() => inputElement?.focus(), 100);
    }
  });
  
  // Send message
  async function sendMessage() {
    if (!inputText.trim() || isStreaming) return;
    
    const userMessage = inputText.trim();
    inputText = '';
    
    // Add user message
    messages.push({ role: 'user', content: userMessage });
    
    // Start streaming AI response
    isStreaming = true;
    currentStreamingMessage = '';
    
    try {
      const conversationHistory: CoreMessage[] = [...messages];
      
      const response = await streamAIResponse(
        conversationHistory,
        {
          systemPrompt: 'You are a helpful accounting assistant for Sereus Bonum, a double-entry bookkeeping application. Help users understand accounting concepts, set up their books, and complete tasks. Be friendly, clear, and concise.',
          temperature: 0.7,
        }
      );
      
      // Read the stream (textStream already returns strings, not ArrayBuffers)
      const reader = response.textStream.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // value is already a string from the AI SDK
          currentStreamingMessage += value;
        }
      } finally {
        reader.releaseLock();
      }
      
      // Add complete AI message to history
      messages.push({ role: 'assistant', content: currentStreamingMessage });
      currentStreamingMessage = '';
      
    } catch (error) {
      console.error('[AI Assistant] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      messages.push({ 
        role: 'assistant', 
        content: `Sorry, I encountered an error: ${errorMessage}. Please check your AI settings.` 
      });
    } finally {
      isStreaming = false;
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  // Clear conversation
  function clearConversation() {
    if (confirm('Clear the entire conversation?')) {
      messages = [];
      currentStreamingMessage = '';
    }
  }
  
  // Close panel
  function close() {
    isOpen = false;
  }
</script>

{#if isOpen}
  <aside class="ai-assistant" class:open={isOpen}>
    <!-- Header -->
    <header class="ai-header">
      <div class="ai-header-content">
        <h2>AI Help</h2>
        <div class="ai-header-actions">
          {#if messages.length > 0}
            <button 
              class="btn-clear" 
              onclick={clearConversation}
              title="Clear conversation"
            >
              Clear
            </button>
          {/if}
          <button 
            class="btn-close" 
            onclick={close}
            title="Close AI Help"
          >
            ✕
          </button>
        </div>
      </div>
      {#if !$settings.ai.enabled}
        <div class="ai-disabled-warning">
          ⚠️ AI assistant is disabled. Enable it in <a href="/settings">Settings</a>.
        </div>
      {/if}
    </header>
    
    <!-- Messages -->
    <div class="ai-messages" bind:this={messagesContainer}>
      {#if messages.length === 0 && !currentStreamingMessage}
        <div class="ai-welcome">
          <p><strong>👋 Hello! I'm your AI assistant.</strong></p>
          <p>I can help you with:</p>
          <ul>
            <li>Understanding accounting concepts</li>
            <li>Setting up your accounts and balance sheet</li>
            <li>Entering transactions</li>
            <li>General questions about Bonum</li>
          </ul>
          <p>What would you like to know?</p>
        </div>
      {:else}
        {#each messages as message}
          <div class="ai-message {message.role}">
            <div class="ai-message-label">
              {message.role === 'user' ? 'You' : 'AI'}
            </div>
            <div class="ai-message-content">
              {message.content}
            </div>
          </div>
        {/each}
        
        {#if currentStreamingMessage}
          <div class="ai-message assistant streaming">
            <div class="ai-message-label">AI</div>
            <div class="ai-message-content">
              {currentStreamingMessage}<span class="cursor">▋</span>
            </div>
          </div>
        {/if}
      {/if}
    </div>
    
    <!-- Input -->
    <div class="ai-input-area">
      <textarea
        bind:this={inputElement}
        bind:value={inputText}
        onkeydown={handleKeydown}
        placeholder="Ask me anything..."
        rows="3"
        disabled={!$settings.ai.enabled || isStreaming}
      ></textarea>
      <button 
        class="btn-send" 
        onclick={sendMessage}
        disabled={!inputText.trim() || !$settings.ai.enabled || isStreaming}
      >
        {isStreaming ? 'Thinking...' : 'Send'}
      </button>
    </div>
  </aside>
{/if}

<style>
  .ai-assistant {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    background: var(--bg-card);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  }
  
  .ai-header {
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }
  
  .ai-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .ai-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }
  
  .ai-header-actions {
    display: flex;
    gap: var(--space-sm);
  }
  
  .btn-clear,
  .btn-close {
    background: none;
    border: none;
    padding: var(--space-xs) var(--space-sm);
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
  }
  
  .btn-clear:hover,
  .btn-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .btn-close {
    font-size: 1.25rem;
    font-weight: bold;
    padding: var(--space-xs);
  }
  
  .ai-disabled-warning {
    margin-top: var(--space-md);
    padding: var(--space-sm);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    color: rgb(220, 38, 38);
  }
  
  .ai-disabled-warning a {
    color: inherit;
    text-decoration: underline;
  }
  
  .ai-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  .ai-welcome {
    color: var(--text-secondary);
  }
  
  .ai-welcome p {
    margin: 0 0 var(--space-md) 0;
  }
  
  .ai-welcome ul {
    margin: var(--space-md) 0;
    padding-left: var(--space-lg);
  }
  
  .ai-welcome li {
    margin: var(--space-xs) 0;
  }
  
  .ai-message {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .ai-message-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  
  .ai-message-content {
    padding: var(--space-md);
    border-radius: var(--radius-md);
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  .ai-message.user .ai-message-content {
    background: var(--accent-color);
    color: white;
    align-self: flex-end;
    max-width: 85%;
  }
  
  .ai-message.assistant .ai-message-content {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .ai-message.streaming .ai-message-content {
    border-color: var(--accent-color);
  }
  
  .cursor {
    animation: blink 1s infinite;
    color: var(--accent-color);
  }
  
  @keyframes blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  
  .ai-input-area {
    padding: var(--space-lg);
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    display: flex;
    gap: var(--space-sm);
    align-items: flex-end;
  }
  
  .ai-input-area textarea {
    flex: 1;
    padding: var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.875rem;
    resize: none;
    min-height: 60px;
    max-height: 150px;
  }
  
  .ai-input-area textarea:focus {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
  }
  
  .ai-input-area textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-send {
    padding: var(--space-sm) var(--space-lg);
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }
  
  .btn-send:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  
  .btn-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .ai-assistant {
      width: 100%;
    }
  }
</style>

