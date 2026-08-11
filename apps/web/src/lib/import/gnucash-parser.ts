import type {
  ParsedBooks, ParsedAccount, ParsedTransaction, ParsedEntry, ParsedCommodity, ParsedRate,
} from './types';
import { log } from '$lib/logger';

/**
 * Parse GnuCash XML file.
 *
 * Multi-unit handling (see design/specs/domain/units.md):
 *  - commodities become Bonum units; non-currencies are namespaced ("NYSE:VPER") because tickers
 *    collide across markets, and `cmdty:fraction` becomes the unit's displayDivisor.
 *  - a split's `quantity` is in the ACCOUNT's commodity, its `value` in the TRANSACTION's currency;
 *    those map straight onto Bonum's entry amount/value pair.
 *  - the price database becomes reference rates.
 */
export async function parseGnuCashXML(fileContent: string): Promise<ParsedBooks> {
  log.data.info('[GnuCash] Starting parse');

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fileContent, 'text/xml');

  // Check for parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  const commodities = parseCommodities(xmlDoc);
  const divisorByUnit = new Map(commodities.map((c) => [c.id, c.displayDivisor]));
  const accounts = parseAccounts(xmlDoc);
  const unitByAccount = new Map(accounts.map((a) => [a.guid, a.unitCode]));
  const transactions = parseTransactions(xmlDoc, unitByAccount, divisorByUnit);
  const rates = parseRates(xmlDoc);

  log.data.info('[GnuCash] Parse complete:', {
    accounts: accounts.length,
    transactions: transactions.length,
    commodities: commodities.length,
    rates: rates.length,
  });

  return { accounts, transactions, commodities, rates };
}

// -----------------------------------------------------------------------------
// Commodities → units
// -----------------------------------------------------------------------------

/**
 * GnuCash identifies a commodity by (space, id). `CURRENCY:USD` is the dollar; `NYSE:VPER` and
 * `NASDAQ:VPER` are two DIFFERENT securities that share a ticker — so the namespace has to survive
 * into the unit code, which is Bonum's primary key.
 */
export function unitCodeFor(space: string, id: string): string {
  return space.toUpperCase() === 'CURRENCY' ? id.toUpperCase() : `${space}:${id}`;
}

function unitTypeFor(space: string): ParsedCommodity['unitType'] {
  const s = space.toUpperCase();
  if (s === 'CURRENCY') return 'FIAT';
  if (s === 'FUND') return 'SECURITY';
  if (s === 'TEMPLATE') return 'OTHER';
  return 'SECURITY'; // NYSE, NASDAQ, AMEX, ...
}

function parseCommodities(xmlDoc: Document): ParsedCommodity[] {
  // A CSS type selector matches by localName across namespaces, so `commodity` picks up both the
  // <gnc:commodity> *definitions* and every <act:commodity> *reference*. Only definitions carry
  // <cmdty:fraction> and <cmdty:name>, so merge by code and let a definition win regardless of the
  // order they appear in the file.
  const byCode = new Map<string, ParsedCommodity>();

  xmlDoc.querySelectorAll('commodity').forEach((node) => {
    const id = getTextContent(node, 'id');
    const space = getTextContent(node, 'space');
    if (!id || !space || space.toUpperCase() === 'TEMPLATE') return;

    const code = unitCodeFor(space, id);
    // `fraction` is the smallest tradable increment (100 for dollars, 10000 for shares). It IS the
    // displayDivisor — forcing everything through 100 corrupts share counts rather than rounding them.
    const fraction = parseInt(getTextContent(node, 'fraction') || '', 10);
    const hasFraction = Number.isFinite(fraction) && fraction > 0;
    const name = getTextContent(node, 'name');

    const existing = byCode.get(code);
    // A bare reference adds nothing once we have the definition.
    if (existing && !hasFraction && !name) return;

    byCode.set(code, {
      id: code,
      name: name || existing?.name || id,
      symbol: id,
      unitType: unitTypeFor(space),
      displayDivisor: hasFraction ? fraction : (existing?.displayDivisor ?? 100),
      isCurrency: space.toUpperCase() === 'CURRENCY',
    });
  });

  return [...byCode.values()];
}

// -----------------------------------------------------------------------------
// Accounts
// -----------------------------------------------------------------------------

function parseAccounts(xmlDoc: Document): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const accountNodes = xmlDoc.querySelectorAll('book > account');

  accountNodes.forEach((node) => {
    const guid = getTextContent(node, 'id') || '';
    const name = getTextContent(node, 'name') || '';
    const type = getTextContent(node, 'type') || '';
    const code = getTextContent(node, 'code');
    const description = getTextContent(node, 'description');
    const parentGuid = getTextContent(node, 'parent');
    const unitCode = commodityRef(node, 'commodity');

    if (guid && name) {
      accounts.push({ guid, name, type, code, description, parentGuid, unitCode });
    }
  });

  return accounts;
}

/** Read a `<*:commodity><cmdty:space/><cmdty:id/></*:commodity>` reference as a unit code. */
function commodityRef(parent: Element, selectors: string): string | undefined {
  const el = querySelectorAny(parent, selectors);
  if (!el) return undefined;
  const space = getTextContent(el, 'space');
  const id = getTextContent(el, 'id');
  return space && id ? unitCodeFor(space, id) : undefined;
}

// -----------------------------------------------------------------------------
// Transactions & splits
// -----------------------------------------------------------------------------

function parseTransactions(
  xmlDoc: Document,
  unitByAccount: Map<string, string | undefined>,
  divisorByUnit: Map<string, number>,
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const txnNodes = xmlDoc.querySelectorAll('book > transaction');

  txnNodes.forEach((node) => {
    const guid = getTextContent(node, 'id') || '';
    const datePosted = getTextContent(node, 'date-posted date') || '';
    const description = getTextContent(node, 'description') || '';
    const reference = getTextContent(node, 'num');
    // The transaction's currency is what its split VALUES are denominated in — Bonum's reckoning unit.
    const valueUnit = commodityRef(node, 'currency');

    // Parse date from GnuCash format (YYYY-MM-DD HH:MM:SS +0000)
    const date = datePosted.split(' ')[0];

    const entries = parseSplits(node, valueUnit, unitByAccount, divisorByUnit);

    if (guid && date && entries.length > 0) {
      transactions.push({ guid, date, description, reference, valueUnit, entries });
    }
  });

  return transactions;
}

function parseSplits(
  txnNode: Element,
  valueUnit: string | undefined,
  unitByAccount: Map<string, string | undefined>,
  divisorByUnit: Map<string, number>,
): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const splitNodes = txnNode.querySelectorAll('splits split');
  const valueDivisor = (valueUnit && divisorByUnit.get(valueUnit)) || 100;

  splitNodes.forEach((node) => {
    const guid = getTextContent(node, 'id') || '';
    const accountGuid = getTextContent(node, 'account') || '';
    const memo = getTextContent(node, 'memo');
    if (!guid || !accountGuid) return;

    // `value` is in the transaction's currency; `quantity` is in the account's commodity. They're
    // equal for ordinary same-unit splits and diverge for stock/FX legs.
    const valueStr = getTextContent(node, 'value') || '0/1';
    const qtyStr = getTextContent(node, 'quantity') || valueStr;

    const acctUnit = unitByAccount.get(accountGuid);
    const acctDivisor = (acctUnit && divisorByUnit.get(acctUnit)) || 100;

    entries.push({
      guid,
      accountGuid,
      amount: rationalToSmallestUnit(qtyStr, acctDivisor),
      value: rationalToSmallestUnit(valueStr, valueDivisor),
      memo,
    });
  });

  return entries;
}

/**
 * Convert a GnuCash rational ("numerator/denominator") into an integer count of the target unit's
 * smallest increment.
 *
 * The source denominator is the *source* commodity's SCU and is NOT always 100 — securities use
 * 10000. Rescaling has to go through the target unit's own divisor: "-1752110000/10000" with a
 * divisor of 10000 is 175,211 shares, and the old fixed-100 path turned that into nonsense.
 */
export function rationalToSmallestUnit(rational: string, displayDivisor: number): number {
  const parts = rational.split('/');
  if (parts.length !== 2) return 0;

  const numerator = parseInt(parts[0], 10);
  const denominator = parseInt(parts[1], 10);
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) return 0;

  if (denominator === displayDivisor) return numerator; // already in the right increment
  return Math.round((numerator * displayDivisor) / denominator);
}

// -----------------------------------------------------------------------------
// Price database → reference rates
// -----------------------------------------------------------------------------

function parseRates(xmlDoc: Document): ParsedRate[] {
  const rates: ParsedRate[] = [];

  xmlDoc.querySelectorAll('pricedb price').forEach((node) => {
    const unitA = commodityRef(node, 'commodity');
    const unitB = commodityRef(node, 'currency');
    const value = getTextContent(node, 'value');
    const time = getTextContent(node, 'time date');
    if (!unitA || !unitB || !value || !time) return;

    // Keep the exact rational — a $0.0132 share price must round-trip, so never go via a decimal.
    const [numStr, denStr] = value.split('/');
    const numerator = parseInt(numStr, 10);
    const denominator = parseInt(denStr, 10);
    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) return;

    rates.push({
      date: time.split(' ')[0],
      unitA,
      unitB,
      numerator,
      denominator,
      source: getTextContent(node, 'source') || 'gnucash',
    });
  });

  return rates;
}

// -----------------------------------------------------------------------------
// DOM helpers
// -----------------------------------------------------------------------------

/**
 * GnuCash XML is namespaced (`act:id`, `cmdty:id`, `split:id`), and a CSS type selector matches by
 * *localName* across namespaces — so a descendant query for `id` inside `<gnc:transaction>` can just
 * as easily return the `<cmdty:id>` buried in `<trn:currency>` as the `<trn:id>` we wanted. Which one
 * wins depends on document order, which is not a contract.
 *
 * So resolve by walking direct children and comparing localName. Order-independent and unambiguous.
 */
function child(parent: Element, localName: string): Element | undefined {
  for (const el of parent.children) {
    if (el.localName === localName) return el;
  }
  return undefined;
}

/** Text of a direct child, or of a `"outer inner"` two-level path (e.g. "date-posted date"). */
function getTextContent(parent: Element, path: string): string | undefined {
  let el: Element | undefined = parent;
  for (const name of path.split(' ')) {
    el = el && child(el, name);
  }
  const text = el?.textContent?.trim();
  return text || undefined;
}

function querySelectorAny(parent: Element, localName: string): Element | null {
  return child(parent, localName) ?? null;
}
