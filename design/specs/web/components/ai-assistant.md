# Spec: AI Assistant Component

**Type:** Reusable Component  
**Source:** Story 07  
**Status:** Draft

---

## Purpose

Conversational AI assistant for helping users understand accounting concepts and complete tasks.

---

## Technical Integration

**AI SDK:** Vercel AI SDK (`ai` npm package)  
**Provider:** User-configured in Settings (OpenAI, Anthropic, Google - user supplies API key)  
**Architecture:** Direct browser-to-provider communication
- Uses `dangerouslyAllowBrowser: true` flag (safe since users provide their own keys)
- No server required (static site deployment)
- API keys stored in browser localStorage

---

## Notes

- More details to come.  For now, infer what you need from the stories.
