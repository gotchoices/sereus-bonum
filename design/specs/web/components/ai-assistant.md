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
**Architecture:** Server-side proxy via SvelteKit API routes
- Client calls `/api/ai/generate` (non-streaming) or `/api/ai/stream` (streaming)
- API routes use Vercel AI SDK to call providers server-side
- Avoids CORS issues (Anthropic blocks direct browser calls)
- API keys stored in browser localStorage (Phase 1)

---

## Notes

- More details to come.  For now, infer what you need from the stories.
- Future consideration: Server-side key storage for enhanced security
