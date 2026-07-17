# User Story: AI-Assisted Capture & Import

**Status:** Draft / exploratory — sets direction, not final scope.

## Story Overview
As a user, I want to hand the AI assistant a receipt photo or an unfamiliar data file and have it
propose the right transactions or account mappings, so I can capture and import data without manual
transcription.

Context: This builds on the AI assistant introduced in [07-ai-assistant.md](./07-ai-assistant.md),
which focuses on teaching and setup. Here the assistant does ingestion work: (a) capturing images of
receipts, invoices, and bills, and (b) making sense of import sources beyond the canonical importers.
Canonical formats (e.g. GnuCash) are handled directly per [domain/import.md](../../specs/domain/import.md);
the assistant extends coverage to arbitrary sources. In every case the assistant *proposes* and the
user *approves* — nothing is written unreviewed.

## Sequence
1. Diego photographs a store receipt and drops the image into the assistant.
2. The assistant reads it — vendor, date, total, and line items — and proposes a transaction: which
   account to credit (his cash or card), which expense account(s) to debit, and a memo. It asks about
   anything ambiguous.
3. Diego reviews the proposal, corrects one category, and approves. The transaction is entered, and
   the receipt image is attached to the record for future reference.

Alternative Path A: A Bill to Pay Later
4.1. Diego captures a vendor bill instead of a paid receipt.
4.2. The assistant proposes an accounts-payable transaction (credit Accounts Payable, debit the
    expense/asset) and flags it as owed, so it surfaces when he later pays vendors.

Alternative Path B: Making Sense of an Arbitrary File
5.1. Diego has a CSV export from a service that isn't a recognized format (it could equally be a
    spreadsheet or an XML file).
5.2. The assistant inspects the columns and structure, proposes a mapping to Bonum accounts and
    fields, and shows a preview of the transactions it would create.
5.3. Diego adjusts a couple of mappings and approves. The import runs through the same atomic,
    roll-back-on-failure path as any other import.

Alternative Path C: Learning From Corrections
6.1. When Diego re-maps a column or recategorizes a vendor, the assistant remembers the choice for
    next time from the same source, so repeat imports need less intervention.

## Acceptance Criteria
- [ ] The assistant accepts an image (receipt/invoice/bill) and proposes a transaction with accounts, amount, date, and memo.
- [ ] Captured images can be attached to the resulting transaction record.
- [ ] The assistant can map an arbitrary tabular or structured file to Bonum accounts and fields, with a preview, when no canonical importer applies.
- [ ] Canonical importers (e.g. GnuCash) remain the direct path for known formats.
- [ ] Nothing is written without user review and confirmation; low-confidence fields are flagged, not guessed.
- [ ] AI-assisted imports use the same atomic, roll-back-on-failure execution as manual import.

## Variants
- **happy:** A clear receipt or well-formed file yields an accurate proposal the user approves in one pass.
- **empty:** An unreadable image or an empty file — the assistant says it couldn't extract anything and offers manual entry.
- **error:** Low-confidence extractions are surfaced with uncertain fields marked and never auto-committed; ambiguous account matches are asked about rather than guessed.

## Notes
- Depends on the assistant infrastructure and provider setup in [07-ai-assistant.md](./07-ai-assistant.md).
- Import execution and duplicate handling follow [domain/import.md](../../specs/domain/import.md).
- Image attachment storage is an open question (Sereus file handling vs external reference) — shared with the Invoices future feature.
