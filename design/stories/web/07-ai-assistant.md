# User Story: AI Assistant - Getting Started & Interactive Setup

## Story Overview
As a new user with no accounting experience, I want an AI assistant to help me understand accounting concepts and guide me through setting up my first balance sheet, so I can get started quickly without feeling overwhelmed.

Context: Maria has just installed Sereus Bonum and opened it for the first time. She wants to track her personal finances but doesn't understand terms like "debit," "credit," or "balance sheet." She notices an "AI Help" option in the global menu.

## Sequence
1. Maria clicks the "AI Help" option in the global menu. A wizard bubble appears on the right side of her screen with a clean conversation interface.
2. She types: "I'm new to accounting. How do I get started?"
3. The AI assistant responds with a friendly greeting, explains that Bonum uses double-entry accounting, and offers to either:
   - Explain basic accounting concepts
   - Guide her through creating her first entity and accounts
   - Answer specific questions about features
4. Maria asks: "What is a debit and what is a credit?"
5. The AI explains debits and credits in plain language, using examples from everyday life (e.g., "When you deposit money in your checking account, you debit the asset account and credit the source").
6. Maria feels more confident and asks: "Can you help me set up a balance sheet?"
7. The AI explains that a balance sheet shows what she owns (assets), what she owes (liabilities), and her net worth (equity) at a specific point in time. It offers to guide her through creating beginning balances.
8. She agrees. The AI begins asking questions:
   - "Do you have any checking accounts? If so, what is the current balance?"
   - "Do you use any electronic payment services like Venmo or PayPal?"
   - "Do you own any significant assets like a car or home?"
   - "Do you have any credit cards with balances?"
   - "Do you have a mortgage or other loans?"
9. For each question, Maria provides details by consulting her bank statements, credit card statements, and mortgage documents.
10. The AI summarizes what it has gathered and shows her a preview of the accounts it will create and the opening balances it will enter.
11. Maria reviews the preview. She notices the AI included her car as a fixed asset, which she hadn't thought about. She approves the setup.
12. The AI creates the entity, account structure, and opening balance transactions. Maria now sees a populated balance sheet and can begin entering new transactions.

Alternative Path A: Explaining Other Concepts
5.1. Instead of asking about debits and credits, Maria asks: "What is accrual accounting?"
5.2. The AI explains accrual vs. cash-basis accounting, using examples (e.g., recording income when earned vs. when paid).
5.3. Maria asks follow-up questions, and the AI answers each one, maintaining context from previous questions.

Alternative Path B: Starting with a Template
7.1. Instead of setting up from scratch, Maria asks: "Can I start with a template?"
7.2. The AI explains that Bonum includes templates (Home Finance, Small Business) and offers to guide her through selecting and customizing one.
7.3. Maria chooses the Home Finance template. The AI asks her to confirm or modify the default account groups.
7.4. She proceeds with entering opening balances as in the main sequence.

Alternative Path C: Exploring Features First
3.1. Maria asks: "What can I do with this app?"
3.2. The AI provides an overview of key features: managing entities, entering transactions, viewing reports, importing books, reconciling accounts.
3.3. Maria asks: "How do I enter a transaction?"
3.4. The AI explains the ledger view, keyboard shortcuts, split entries, and offers to open a demo ledger or walk her through entering her first real transaction.

Alternative Path D: Refining the Setup
10.1. Maria reviews the preview and notices the AI categorized her credit card as a liability (correct), but the balance is wrong.
10.2. She corrects the balance in the conversation: "The Visa balance should be $1,245, not $1,450."
10.3. The AI updates the preview and asks if everything looks correct now.
10.4. Maria approves, and the setup proceeds.

## Acceptance Criteria
- [ ] AI assistant is accessible from the global menu
- [ ] Conversation interface supports multi-turn dialogue with context
- [ ] AI can explain basic accounting concepts in plain language
- [ ] AI can guide users through creating entities and account structures
- [ ] AI asks clarifying questions to gather necessary information
- [ ] AI provides a preview/summary before making changes
- [ ] User can review and correct AI-generated data before approval
- [ ] Conversation can be exported (PDF, text) for reference
- [ ] AI maintains context throughout the conversation (remembers previous questions)
- [ ] AI provides helpful suggestions based on user's current screen/context

## Notes
- See `docs/STATUS.md` → "AI-Assisted Features" section for implementation phasing
- Related specs:
  - `design/specs/web/components/ai-wizard.md` (Component spec)
- Integration: Vercel AI SDK (`ai` npm package)
- Advanced features (voice, OCR, custom reports) are documented in STATUS.md as Phase 6
