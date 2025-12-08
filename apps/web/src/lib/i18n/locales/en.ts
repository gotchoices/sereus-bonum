// English dictionary
// See: design/specs/web/global/i18n.md

export default {
  app: {
    name: 'Bonum',
    tagline: 'Personal and business finance management',
  },
  
  nav: {
    home: 'Home',
    catalog: 'Account Groups',
    import: 'Import Books',
    settings: 'Settings',
  },
  
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    add: 'Add',
    loading: 'Loading...',
    error: 'An error occurred',
    expand_all: 'Expand All',
    collapse_all: 'Collapse All',
  },
  
  entities: {
    title: 'Entities',
    add: 'Add Entity',
    edit: 'Edit Entity',
    delete: 'Delete Entity',
    delete_confirm: 'Are you sure you want to delete this entity?',
    no_entities: 'No entities yet',
    create_prompt: 'Create one to get started',
    select: 'Select entity...',
    none_selected: 'No entity selected',
  },
  
  catalog: {
    title: 'Account Groups Catalog',
    add_group: 'Add Group',
    groups_count: '{{count}} groups',
    no_groups: 'No account groups defined',
    no_children: 'No child groups',
  },
  
  account_types: {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    INCOME: 'Income',
    EXPENSE: 'Expenses',
  },
  
  welcome: {
    title: 'Welcome to Bonum',
    intro: 'Bonum helps you manage personal and business finances with proper double-entry accounting.',
    getting_started: 'Getting Started',
    select_entity: 'Select an entity from the list to view its balance sheet',
    import_books: 'Import existing books from GnuCash or QuickBooks',
    create_entity: 'Create a new entity using the + button',
    nav_tips: 'Navigation Tips',
    click_navigate: 'Click any hyperlink to navigate in the current view',
    ctrl_click: 'Ctrl/Cmd + Click to open in a new window',
    right_click: 'Right-click entities for quick actions',
    dont_show_again: "Don't show this again",
    get_started: 'Get Started',
  },
  
  balance_sheet: {
    net_worth: 'Net Worth',
    assets: 'Assets',
    liabilities: 'Liabilities',
    equity: 'Equity',
    no_data: 'No data',
    add_transactions: 'Add transactions to see your balance sheet',
  },
  
  accounts: {
    title: 'Accounts',
    view: 'View Accounts',
    import_transactions: 'Import Transactions',
  },
} as const;

