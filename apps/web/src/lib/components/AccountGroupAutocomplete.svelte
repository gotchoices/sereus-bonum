<script lang="ts">
  import type { AccountGroup } from '$lib/data';
  
  interface Props {
    groups: AccountGroup[];
    value: string;
    onInput: (value: string) => void;
    onSelect: (groupPath: string, groupId: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    class?: string;
  }
  
  let { 
    groups, 
    value = $bindable(),
    onInput,
    onSelect, 
    onBlur,
    placeholder = "Type to search groups...",
    class: className = ""
  }: Props = $props();
  
  let showSuggestions = $state(false);
  let highlightedIndex = $state(0);
  let inputElement: HTMLInputElement;
  
  // Build full path for a group
  function buildPath(groupId: string): string {
    const groupMap = new Map(groups.map(g => [g.id, g]));
    const path: string[] = [];
    let current = groupMap.get(groupId);
    
    while (current) {
      path.unshift(current.name);
      current = current.parentId ? groupMap.get(current.parentId) : undefined;
    }
    
    return path.join(':');
  }
  
  // Get all group paths
  const allPaths = $derived(groups.map(g => ({
    id: g.id,
    path: buildPath(g.id),
    segments: buildPath(g.id).split(':')
  })));
  
  // Filter and sort suggestions
  const suggestions = $derived.by(() => {
    if (!value || value.length === 0) return [];
    
    const query = value.toLowerCase().trim();
    const querySegments = query.split(':').filter(s => s.length > 0);
    
    // If query ends with ':', show only children of that path
    if (value.endsWith(':')) {
      const parentPath = querySegments.join(':');
      return allPaths
        .filter(p => p.path.toLowerCase().startsWith(parentPath.toLowerCase() + ':'))
        .slice(0, 10);
    }
    
    // Otherwise, filter by matching query
    const matches = allPaths.filter(p => 
      p.path.toLowerCase().includes(query)
    );
    
    // Sort by relevance
    return matches.sort((a, b) => {
      const aPath = a.path.toLowerCase();
      const bPath = b.path.toLowerCase();
      
      // Exact match first
      if (aPath === query) return -1;
      if (bPath === query) return 1;
      
      // Starts with query
      if (aPath.startsWith(query) && !bPath.startsWith(query)) return -1;
      if (bPath.startsWith(query) && !aPath.startsWith(query)) return 1;
      
      // Alphabetical
      return aPath.localeCompare(bPath);
    }).slice(0, 10);
  });
  
  // Handle input
  function handleInput(e: Event) {
    const newValue = (e.target as HTMLInputElement).value;
    value = newValue;
    onInput(newValue);
    showSuggestions = true;
    highlightedIndex = 0;
  }
  
  // Handle keydown
  function handleKeydown(e: KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === ':') {
        // Start showing suggestions on colon
        showSuggestions = true;
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, suggestions.length - 1);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        break;
        
      case ':':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          completeToColon();
        }
        break;
        
      case 'Tab':
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        showSuggestions = false;
        break;
    }
  }
  
  // Complete up to next colon
  function completeToColon() {
    const highlighted = suggestions[highlightedIndex];
    if (!highlighted) return;
    
    const currentSegments = value.split(':').filter(s => s.length > 0);
    const targetSegments = highlighted.segments;
    
    // Find how many segments we can complete
    let completeUpTo = currentSegments.length;
    if (completeUpTo < targetSegments.length) {
      completeUpTo++;
    }
    
    const newValue = targetSegments.slice(0, completeUpTo).join(':') + ':';
    value = newValue;
    onInput(newValue);
    showSuggestions = true;
    highlightedIndex = 0;
    
    // Keep focus
    inputElement?.focus();
  }
  
  // Select a suggestion
  function selectSuggestion(suggestion: typeof suggestions[0]) {
    value = suggestion.path;
    onInput(suggestion.path);
    onSelect(suggestion.path, suggestion.id);
    showSuggestions = false;
  }
  
  // Handle blur
  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      showSuggestions = false;
      onBlur?.();
    }, 200);
  }
  
  // Handle focus
  function handleFocus() {
    if (value) {
      showSuggestions = true;
    }
  }
</script>

<div class="autocomplete-wrapper">
  <input
    bind:this={inputElement}
    type="text"
    {value}
    {placeholder}
    class="autocomplete-input {className}"
    oninput={handleInput}
    onkeydown={handleKeydown}
    onblur={handleBlur}
    onfocus={handleFocus}
  />
  
  {#if showSuggestions && suggestions.length > 0}
    <div class="suggestions-dropdown">
      {#each suggestions as suggestion, i}
        <button
          class="suggestion-item"
          class:highlighted={i === highlightedIndex}
          onmousedown={(e) => { e.preventDefault(); selectSuggestion(suggestion); }}
          onmouseenter={() => highlightedIndex = i}
        >
          {suggestion.path}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .autocomplete-wrapper {
    position: relative;
    width: 100%;
  }
  
  .autocomplete-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .autocomplete-input:focus {
    outline: none;
    border-color: var(--accent-color, #007bff);
  }
  
  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #ddd);
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    margin-top: 2px;
  }
  
  .suggestion-item {
    display: block;
    width: 100%;
    padding: 0.5rem;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .suggestion-item:hover,
  .suggestion-item.highlighted {
    background: var(--bg-hover, #f5f5f5);
  }
</style>

