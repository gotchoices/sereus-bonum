# Project Spec

This document captures key decisions for the project. Complete this during the discovery phase before adding app scaffolds.

## Purpose

**What problem does this project solve?**

Personal and business finance management with proper double-entry accounting. Unlike checkbook-style programs that focus on spending, Bonum takes a balance sheet approach — teaching users to manage and grow net worth, not just cash flow.

Key capabilities:
- Double-entry accounting with balanced transactions
- Multiple entities (businesses, households, personal)
- Multi-currency and generalized unit support
- Reconciliation against external statements
- AR/AP tracking with vendor/customer management

**Who are the target users?**

- Individuals managing personal finances who want real accounting, not just expense tracking
- Small business owners needing proper books without enterprise complexity
- Households wanting to track net worth across multiple accounts
- Anyone wanting financial data ownership without cloud vendor lock-in

**Delivery posture:**

**Production / Industrial-strength** — optimize for correctness, scalability, accessibility, maintainability

This is not a prototype or MVP throwaway. Bonum is intended as a long-term financial record system where:
- Data integrity is paramount (double-entry validation, immutable audit trails)
- Performance matters at scale (10K+ transactions, virtualized rendering)
- Accessibility is required (keyboard-first navigation, screen reader support)
- Code maintainability is essential (clean specs, test coverage, refactoring tolerance)
- Security is critical (local-first data, encrypted sync, user-controlled sharing)

## Platforms

**What platforms will this project target?**

- [x] Mobile (iOS/Android)
- [x] Web (desktop browsers)
- [ ] Desktop (Electron, Tauri)

**Are experiences different per platform?**

Yes — optimized for each context:

- **Desktop/Web:** Maximum productivity. Multiple windows/panels open simultaneously. Dense dashboards, responsive linked views. Rapid data entry, report generation, see lots of data at once.

- **Mobile:** Quick and nimble. Look up information, get answers, make quick entries, record transactions, capture documents/receipts.

## Apps

List the apps to be built:

| App Name | Platform | Framework | Status |
|----------|----------|-----------|--------|
| mobile | iOS/Android | nativescript-svelte | planned |
| web | browser | sveltekit | planned |

## Toolchain

### Mobile

- Framework: **nativescript-svelte** (primary), react-native as fallback
- Language: typescript
- Package manager: yarn

*Strategy: Start with NativeScript-Svelte to explore the ecosystem. If we hit blockers (especially around Sereus native bindings), regenerate in React Native.*

### Web

- Framework: **sveltekit** (primary), nuxt or nextjs as fallback
- Language: typescript
- Package manager: yarn

*Strategy: SvelteKit aligns with mobile (learn Svelte once). Fallback to Nuxt (Vue) or Next.js (React) if needed.*

## Data Strategy

**How will data be managed?**

- [x] Local-first with sync
- [ ] Cloud-only (backend API)
- [x] Offline support required
- [ ] Real-time updates needed

**Backend:**

Sereus Fabric — a peer-to-peer network for secure, distributed data. Data is replicated across the user's cadre of devices. No central cloud server; selective sharing with trusted parties (accountants, partners, advisors) via Sereus permissions.

## Shared Resources

**What will be shared across targets?**

- [x] Schema (data model) — `design/specs/schema/`
- [x] API specs — `design/specs/api/`
- [x] TypeScript types — `packages/shared/`
- [x] Mock data — `mock/data/`

## Notes

- Built on Sereus Fabric — see [Vision](../../docs/Vision.md) for philosophy
- Full data model documented in [Schema](../../docs/Schema.md)
- Multi-currency/inventory model in [Units-and-Exchange](../../docs/Units-and-Exchange.md)
- Schema decisions tracked in [STATUS](../../docs/STATUS.md)

**Quality / performance posture:**

- **Expected scale:** Large
  - Entities: 10-50+ per user (personal, businesses, multiple years)
  - Accounts: 100-500 per entity (hierarchical chart of accounts)
  - Transactions: 10K-100K+ per entity (decades of records)
  - Entries: 20K-500K+ (multi-entry splits common)

- **Critical interactions that must stay fast:**
  - **Ledger scrolling:** Must handle 10K+ transactions without lag (virtual scrolling required)
  - **Account autocomplete:** Sub-100ms response for typeahead search across 500+ accounts
  - **Transaction entry:** Keyboard-driven workflow, no input lag, instant auto-balance calculation
  - **Report generation:** Balance sheets/income statements with 500+ accounts < 1 second
  - **Import processing:** GnuCash files with 17K+ transactions must complete in < 30 seconds
  - **Search/filter:** Cross-entity transaction search across 100K+ entries < 2 seconds
  - **Sync:** P2P data sync must be non-blocking, background, progress-aware

- **Robustness requirements:**
  - **Data validation:** All transactions must balance (Assets = Liabilities + Equity)
  - **Error recovery:** Graceful handling of corrupted imports, partial data, sync conflicts
  - **Audit trail:** Immutable transaction history, timestamped edits, user attribution
  - **Accessibility:** WCAG 2.1 AA compliance (keyboard nav, screen readers, contrast ratios)
  - **Testing:** Unit tests for data integrity, integration tests for import/sync, E2E for critical paths

---

*After completing this document, run `add-app.sh` for each target to scaffold the apps.*

