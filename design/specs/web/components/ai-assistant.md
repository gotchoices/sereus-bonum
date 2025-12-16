# Spec: AI Assistant Component

**Type:** Reusable Component  
**Source:** Story 07  
**Status:** Draft

---

## Purpose

Conversational AI assistant for helping users understand accounting concepts and complete tasks.

## UI
- Assistant is invoked from a button near the bottom of the visible page in the global menu pane
- Button has highly rounded corners and is labeled "Assistant"
- When invoked, the Assistant pane opens and the launch button disappears
- The pane overlaps the other components on the page (including the main menu) rather than being packed in with them
- The pane resides in the very lower left corner of the screen, covering the area where the launch button is/was
- The pane has a header with a darker color, same as the launch button
- Pane has rounded corners and looks much like an application window might in a window manager
- The header includes a minimize button (horizontal bar) which will collapse the pane back to a button
- The pane height, which is persistent, is adjustable by dragging the top edge
- Near the bottom of the pane is an entry for user questions
- To the right of the input pane is a send icon (triangular paper airplane icon)
- The remaining area between header and entry pane is a scrolled history of questions asked and answers given
- The header also contains an icon to clear the conversation

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
