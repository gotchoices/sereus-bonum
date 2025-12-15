# Spec: AI Wizard Bubble

**Type:** Reusable Component  
**Source:** Story 07  
**Status:** Draft

---

## Purpose

A context-aware AI assistant that can overlay any screen to help users complete tasks, answer questions, and guide workflows.

**Example Use Cases:**
- Account mapping during GnuCash import
- Categorizing uncategorized transactions
- Suggesting account structures
- Answering accounting questions in context

---

## Brainstorming
- Might be nice to have a global "AI Help" (or some more catchy title) option
- However, the global menu is fairly narrow, and there is a plan to make it hide itself (dock/undock)
- If I select the AI help, I'd like to be able to:
  - Issue a quick query and get an answer
  - Issue a quick query and have the agent generate actions in the app
  - I'll need a method to review and accept/reject the changes
- Should the global option open a new pane (like along the top or bottom) that has a wider window for typing more involved questions and viewing more involved answers?
- Ideally, the agent will be aware of:
  - What panes I have open (what I'm working on)
  - Which pane my query pertains to (if it can't be inferred)
  - What is the state of my books so far
  - How to query my data
- I'd like to start with some stories (the "what" not "how") and see what the appeus workflow produces for a UX, then possibly refine.
- We need a section in Settings to establish what AI API we are using and insert keys (hopefully the ai module provides for this interface)
- I'm inclined to start with Vercel.  Model will be up to the user.  Bonum is open source so we're not pushing/selling any agent services.

---

## User Experience

<!-- To be drafted after brainstorming -->

---

## Technical Approach

<!-- To be drafted after brainstorming -->

---

## Open Questions

1. **Placement:** Where should the AI bubble appear? (Corner? Sidebar? Overlay?)
2. **Activation:** How does user invoke the AI? (Button? Shortcut? Context menu?)
3. **Context:** How does AI know what screen/task the user is on?
4. **State:** Should conversation history persist across screens?
5. **Privacy:** What data goes to AI API? User consent mechanism?
6. **Offline:** Does it work without internet? Graceful degradation?

---

## Dependencies

- **Vercel AI SDK:** `ai` npm package (already reviewed as desired integration)
- **LLM Provider:** API keys for OpenAI, Anthropic, or similar
- **Context API:** Screen/state information passed to AI for awareness

---

## Notes

- See `docs/STATUS.md` → "AI-Assisted Features" section for strategic roadmap
- First implementation target: Account mapping during import
- Component should be reusable across all screens
- Consider cost implications (API calls per user interaction)

