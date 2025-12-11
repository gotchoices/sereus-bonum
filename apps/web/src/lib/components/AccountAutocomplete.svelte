<script lang="ts">
  import { getDataService } from '$lib/data';
  import { log } from '$lib/logger';
  
  // Props
  let {
    entityId,
    value = $bindable(''),
    selectedId = $bindable(''),
    placeholder = 'Search accounts',
    disabled = false,
    onselect = () => {},
    class: className = ''
  }: {
    entityId: string;
    value: string;
    selectedId: string;
    placeholder?: string;
    disabled?: boolean;
    onselect?: (result: { id: string; name: string; path: string }) => void;
    class?: string;
  } = $props();
  
  // State
  let searchResults = $state<Array<{ id: string; name: string; path: string; code?: string }>>([]);
  let showDropdown = $state(false);
  let selectedIndex = $state(0);
  
  // Search for accounts (max 10 results)
  async function handleSearch() {
    if (!entityId || value.length < 1) {
      searchResults = [];
      showDropdown = false;
      selectedIndex = 0;
      return;
    }
    
    try {
      const ds = await getDataService();
      const results = await ds.searchAccounts(entityId, value);
      searchResults = results.slice(0, 10); // Max 10 results per spec
      showDropdown = results.length > 0;
      selectedIndex = 0; // Reset to top on new search
      log.ui.debug('[AccountAutocomplete] Search results:', results.length);
    } catch (e) {
      log.ui.error('[AccountAutocomplete] Search error:', e);
      searchResults = [];
      showDropdown = false;
    }
  }
  
  // Select an account
  function selectAccount(result: { id: string; name: string; path: string }) {
    selectedId = result.id;
    value = result.path;
    showDropdown = false;
    onselect(result);
    log.ui.debug('[AccountAutocomplete] Selected:', result.path);
  }
  
  // Find longest matching path element (excluding final account name)
  function findLongestMatchingElement(path: string, query: string): number {
    const lowerQuery = query.toLowerCase();
    const pathParts = path.split(' : ');
    
    // Exclude final element (account name - no : after it)
    let longestMatchIndex = -1;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (pathParts[i].toLowerCase().includes(lowerQuery)) {
        longestMatchIndex = i;
      }
    }
    
    return longestMatchIndex;
  }
  
  // Handle keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    // Allow left/right arrows for normal text editing
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      return;
    }
    
    if (!showDropdown && e.key !== ':') return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case ':':
        // Complete through longest matching element of HIGHLIGHTED result
        if (searchResults[selectedIndex]) {
          e.preventDefault();
          const result = searchResults[selectedIndex];
          const longestMatchIndex = findLongestMatchingElement(result.path, value);
          
          if (longestMatchIndex >= 0) {
            const pathParts = result.path.split(' : ');
            value = pathParts.slice(0, longestMatchIndex + 1).join(' : ') + ' : ';
            handleSearch();
          }
        }
        break;
      case 'Tab':
        // Complete to highlighted result and advance focus
        if (searchResults[selectedIndex]) {
          e.preventDefault();
          selectAccount(searchResults[selectedIndex]);
          // Focus will naturally advance (preventDefault stops browser default)
        }
        break;
      case 'Enter':
        // Complete to highlighted result and stay in field
        if (searchResults[selectedIndex]) {
          e.preventDefault();
          selectAccount(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        showDropdown = false;
        break;
    }
  }
  
  // Handle blur - clear if no valid selection
  function handleBlur() {
    setTimeout(() => {
      showDropdown = false;
      // If no selectedId, clear the input
      if (!selectedId && value) {
        value = '';
      }
    }, 200); // Delay to allow click on dropdown
  }
  
  // Clear selection when value changes manually
  function handleInput() {
    if (selectedId && value !== searchResults.find(r => r.id === selectedId)?.path) {
      selectedId = '';
    }
    handleSearch();
  }
</script>

<div class="account-autocomplete {className}">
  <input 
    type="text" 
    bind:value={value}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onfocus={() => handleSearch()}
    onblur={handleBlur}
    {placeholder}
    {disabled}
    class="account-input"
  />
  
  {#if showDropdown && searchResults.length > 0}
    <div class="autocomplete-dropdown">
      {#each searchResults as result, i (result.id)}
        <button 
          class="autocomplete-option"
          class:selected={i === selectedIndex}
          onmousedown={() => selectAccount(result)}
          onmouseenter={() => selectedIndex = i}
        >
          {result.path}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .account-autocomplete {
    position: relative;
    flex: 1;
  }
  
  .account-input {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    font-size: inherit;
    font-family: inherit;
  }
  
  .account-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  
  .account-input:disabled {
    opacity: 0.5;
    background: var(--bg-secondary);
    cursor: not-allowed;
  }
  
  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    margin-top: 2px;
  }
  
  .autocomplete-option {
    display: block;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-primary);
  }
  
  .autocomplete-option:hover,
  .autocomplete-option.selected {
    background: var(--bg-secondary);
  }
</style>

