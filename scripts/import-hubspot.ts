import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type CellValue = string | number | boolean | Date | null | undefined;
type ImportMode = "dry-run" | "commit";
type ActionKind = "insert" | "update" | "noop" | "skip" | "conflict";
type JsonRecord = Record<string, unknown>;

interface CliOptions {
  mode: ImportMode;
  companiesPath: string;
  contactsPath: string;
  reportPath: string;
}

interface SpreadsheetTable {
  filePath: string;
  sheetName: string;
  sheetNames: string[];
  headers: string[];
  rows: CellValue[][];
}

interface ColumnSpec {
  candidates: string[];
  required?: boolean;
}

interface ResolvedColumn {
  actualHeader: string;
  index: number;
}

type ResolvedColumns = Record<string, ResolvedColumn | undefined>;

interface CompanySource {
  rowNumber: number;
  hubspotId: string | undefined;
  name: string | undefined;
  website: string | undefined;
  domain: string | undefined;
  billingAddress: string | undefined;
  billingEmail: string | undefined;
  billingNotes: string | undefined;
  notes: string | undefined;
  poNumberRequired: boolean | undefined;
}

interface ContactSource {
  rowNumber: number;
  hubspotId: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  email: string | undefined;
  emailIsValid: boolean;
  emailDomain: string | undefined;
  phone: string | undefined;
  role: string | undefined;
  contactType: string | undefined;
  lifecycleStage: string | undefined;
  leadStatus: string | undefined;
  source: string | undefined;
  status: string | undefined;
  notes: string | undefined;
  companyName: string | undefined;
  associatedCompanyIds: string[];
  primaryAssociatedCompanyIds: string[];
  hasEnoughIdentity: boolean;
}

interface ExistingCompany {
  id: string;
  hubspot_id: string | null;
  name: string | null;
  website: string | null;
  billing_address: string | null;
  billing_email: string | null;
  billing_notes: string | null;
  notes: string | null;
  po_number_required: boolean | null;
  imported_from: string | null;
}

interface ExistingContact {
  id: string;
  company_id: string | null;
  hubspot_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  contact_type: string | null;
  lifecycle_stage: string | null;
  lead_status: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
}

interface CompanyAction {
  kind: ActionKind;
  source: CompanySource;
  payload: JsonRecord;
  reason: string;
  existing?: ExistingCompany;
}

interface ContactAction {
  kind: ActionKind;
  source: ContactSource;
  payload: JsonRecord;
  reason: string;
  existing?: ExistingContact;
  associatedHubspotCompanyId?: string;
  resolvedCompanyId?: string;
}

const DEFAULT_COMPANIES_PATH = "data/hubspot/All Companies.xlsx";
const DEFAULT_CONTACTS_PATH = "data/hubspot/all-contacts.xlsx";
const REPORT_DIRECTORY = "data/hubspot/reports";
const IMPORT_SOURCE = "hubspot";
const PAGE_SIZE = 1_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_OR_RELAY_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "hotmail.co.uk",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "wixforms.com",
  "yahoo.co.uk",
  "yahoo.com",
]);

const COMPANY_COLUMN_SPECS: Record<string, ColumnSpec> = {
  hubspotId: { candidates: ["Record ID"], required: true },
  name: { candidates: ["Company name"], required: true },
  website: {
    candidates: ["Company domain name", "Website URL", "Website"],
  },
  billingAddress: { candidates: ["Billing Address"] },
  billingEmail: { candidates: ["Billing Email Address"] },
  notes: { candidates: ["Company Preferences"] },
  billingNotes: { candidates: ["Billing Notes"] },
  poNumberRequired: { candidates: ["PO Number Required?"] },
};

const CONTACT_COLUMN_SPECS: Record<string, ColumnSpec> = {
  hubspotId: { candidates: ["Record ID"], required: true },
  firstName: { candidates: ["First Name"], required: true },
  lastName: { candidates: ["Last Name"], required: true },
  email: { candidates: ["Email"], required: true },
  phone: { candidates: ["Phone Number", "Mobile Phone Number"] },
  role: { candidates: ["Job Title", "Employment Role"] },
  contactType: { candidates: ["Contact type"] },
  lifecycleStage: { candidates: ["Lifecycle Stage"] },
  leadStatus: { candidates: ["Lead Status"] },
  source: { candidates: ["Record source", "Original Traffic Source"] },
  status: { candidates: ["Status"] },
  notes: { candidates: ["Notes"] },
  companyName: { candidates: ["Company Name"] },
  associatedCompanyIds: {
    candidates: ["Associated Company IDs"],
  },
  primaryAssociatedCompanyIds: {
    candidates: ["Associated Company IDs (Primary)"],
  },
};

const review = {
  duplicateHubspotIds: [] as JsonRecord[],
  duplicateNormalizedEmails: [] as JsonRecord[],
  conflicts: [] as JsonRecord[],
  skippedRows: [] as JsonRecord[],
  writeErrors: [] as JsonRecord[],
  genericOrRelayEmails: [] as JsonRecord[],
  malformedEmails: [] as JsonRecord[],
  unnamedCompanies: [] as JsonRecord[],
  invalidBooleans: [] as JsonRecord[],
  companyNameSuggestions: [] as JsonRecord[],
  unmatchedContacts: [] as JsonRecord[],
  ambiguousAssociations: [] as JsonRecord[],
};

function usage() {
  return [
    "Usage:",
    "  npm run import:hubspot -- --dry-run",
    "  npm run import:hubspot -- --commit",
    "",
    "Optional paths:",
    "  --companies <path>  Company workbook path",
    "  --contacts <path>   Contact workbook path",
    "  --report <path>     JSON report path",
  ].join("\n");
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseCli(argv: string[]): CliOptions {
  let mode: ImportMode | undefined;
  let companiesPath = DEFAULT_COMPANIES_PATH;
  let contactsPath = DEFAULT_CONTACTS_PATH;
  let reportPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (argument === "--dry-run") {
      if (mode && mode !== "dry-run") {
        throw new Error("Choose exactly one of --dry-run or --commit.");
      }
      mode = "dry-run";
      continue;
    }

    if (argument === "--commit") {
      if (mode && mode !== "commit") {
        throw new Error("Choose exactly one of --dry-run or --commit.");
      }
      mode = "commit";
      continue;
    }

    if (
      argument === "--companies" ||
      argument === "--contacts" ||
      argument === "--report"
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${argument}.`);
      }
      index += 1;
      if (argument === "--companies") companiesPath = value;
      if (argument === "--contacts") contactsPath = value;
      if (argument === "--report") reportPath = value;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!mode) {
    throw new Error(`Import mode is required.\n\n${usage()}`);
  }

  return {
    mode,
    companiesPath: path.resolve(companiesPath),
    contactsPath: path.resolve(contactsPath),
    reportPath: path.resolve(
      reportPath ??
        path.join(
          REPORT_DIRECTORY,
          `hubspot-import-${mode}-${timestampForFilename()}.json`,
        ),
    ),
  };
}

function cleanText(value: CellValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text =
    value instanceof Date ? value.toISOString() : String(value).normalize("NFKC");
  const cleaned = text.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
  return cleaned || undefined;
}

function normalizeHeader(value: CellValue) {
  return cleanText(value)?.toLocaleLowerCase("en-GB") ?? "";
}

function normalizeHubspotId(value: CellValue) {
  const cleaned = cleanText(value)?.replace(/^'+/, "");
  if (!cleaned) return undefined;
  return cleaned.replace(/^(\d+)\.0+$/, "$1");
}

function normalizeEmail(value: CellValue) {
  return cleanText(value)?.toLocaleLowerCase("en-GB");
}

function isValidEmail(email: string | undefined) {
  return Boolean(email && EMAIL_PATTERN.test(email));
}

function emailDomain(email: string | undefined) {
  if (!email || !isValidEmail(email)) return undefined;
  return email.slice(email.lastIndexOf("@") + 1).replace(/\.$/, "");
}

function normalizeDomain(value: CellValue) {
  const cleaned = cleanText(value)?.toLocaleLowerCase("en-GB");
  if (!cleaned) return undefined;

  const candidate = cleaned.includes("@")
    ? cleaned.slice(cleaned.lastIndexOf("@") + 1)
    : cleaned;

  try {
    const url = new URL(
      candidate.includes("://") ? candidate : `https://${candidate}`,
    );
    return url.hostname.replace(/^www\./, "").replace(/\.$/, "") || undefined;
  } catch {
    return undefined;
  }
}

function normalizeName(value: CellValue) {
  return cleanText(value)?.toLocaleLowerCase("en-GB");
}

function parseBoolean(
  value: CellValue,
): { value: boolean | undefined; valid: boolean; raw?: string } {
  const cleaned = cleanText(value)?.toLocaleLowerCase("en-GB");
  if (!cleaned) return { value: undefined, valid: true };
  if (["yes", "y", "true", "1"].includes(cleaned)) {
    return { value: true, valid: true };
  }
  if (["no", "n", "false", "0"].includes(cleaned)) {
    return { value: false, valid: true };
  }
  return { value: undefined, valid: false, raw: cleanText(value) };
}

function splitAssociationIds(value: CellValue) {
  const cleaned = cleanText(value);
  if (!cleaned) return [];
  return [
    ...new Set(
      cleaned
        .split(/[;,|\n]+/)
        .map((part) => normalizeHubspotId(part))
        .filter((part): part is string => Boolean(part)),
    ),
  ];
}

function requireFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing source file: ${filePath}\nPlace the HubSpot exports in ${path.resolve("data/hubspot")}.`,
    );
  }
}

function readSpreadsheet(
  filePath: string,
  identifyingHeaders: string[],
): SpreadsheetTable {
  requireFile(filePath);
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    dense: false,
  });

  const candidates = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    });
    const headers = (rows[0] ?? []).map((value) => cleanText(value) ?? "");
    const normalizedHeaders = new Set(headers.map(normalizeHeader));
    return {
      sheetName,
      headers,
      rows: rows.slice(1),
      matches: identifyingHeaders.every((header) =>
        normalizedHeaders.has(normalizeHeader(header)),
      ),
    };
  });

  const matches = candidates.filter((candidate) => candidate.matches);
  if (matches.length !== 1) {
    const descriptions = candidates
      .map(
        (candidate) =>
          `${candidate.sheetName} (${candidate.headers.length} columns)`,
      )
      .join(", ");
    throw new Error(
      `Expected exactly one worksheet in ${filePath} with headings ${identifyingHeaders.join(
        ", ",
      )}. Found ${matches.length}. Worksheets inspected: ${descriptions}.`,
    );
  }

  return {
    filePath,
    sheetName: matches[0].sheetName,
    sheetNames: workbook.SheetNames,
    headers: matches[0].headers,
    rows: matches[0].rows,
  };
}

function resolveColumns(
  table: SpreadsheetTable,
  specs: Record<string, ColumnSpec>,
) {
  const headerIndices = new Map<string, number[]>();
  table.headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const existing = headerIndices.get(normalized) ?? [];
    existing.push(index);
    headerIndices.set(normalized, existing);
  });

  const resolved: ResolvedColumns = {};
  const usedIndices = new Set<number>();

  for (const [key, spec] of Object.entries(specs)) {
    let match: ResolvedColumn | undefined;
    for (const candidate of spec.candidates) {
      const indices = headerIndices.get(normalizeHeader(candidate)) ?? [];
      if (indices.length > 1) {
        throw new Error(
          `Ambiguous heading "${candidate}" in ${table.filePath} (${indices.length} occurrences).`,
        );
      }
      if (indices.length === 1) {
        match = {
          actualHeader: table.headers[indices[0]],
          index: indices[0],
        };
        break;
      }
    }

    if (!match && spec.required) {
      throw new Error(
        `Required HubSpot heading missing from ${table.filePath}: one of ${spec.candidates.join(
          ", ",
        )}.`,
      );
    }

    resolved[key] = match;
    if (match) usedIndices.add(match.index);
  }

  const headingOccurrences = new Map<string, number>();
  const unmappedColumns = table.headers
    .map((header, index) => {
      if (usedIndices.has(index)) return undefined;
      const displayHeader = header || "(blank heading)";
      const occurrence =
        (headingOccurrences.get(displayHeader) ?? 0) + 1;
      headingOccurrences.set(displayHeader, occurrence);
      const totalOccurrences = table.headers.filter(
        (candidate) => candidate === header,
      ).length;
      return {
        heading:
          totalOccurrences > 1
            ? `${displayHeader} [occurrence ${occurrence}]`
            : displayHeader,
        columnNumber: index + 1,
        nonBlankRows: table.rows.filter((row) =>
          Boolean(cleanText(row[index])),
        ).length,
      };
    })
    .filter((column): column is NonNullable<typeof column> => Boolean(column));

  return {
    resolved,
    mappedColumns: Object.fromEntries(
      Object.entries(resolved)
        .filter((entry): entry is [string, ResolvedColumn] =>
          Boolean(entry[1]),
        )
        .map(([key, column]) => [
          key,
          {
            heading: column.actualHeader,
            columnNumber: column.index + 1,
          },
        ]),
    ),
    unmappedColumns,
  };
}

function cell(
  row: CellValue[],
  column: ResolvedColumn | undefined,
): CellValue {
  return column ? row[column.index] : undefined;
}

function findDuplicateGroups<T>(
  records: T[],
  getKey: (record: T) => string | undefined,
  getRowNumber: (record: T) => number,
) {
  const grouped = new Map<string, number[]>();
  for (const record of records) {
    const key = getKey(record);
    if (!key) continue;
    const rows = grouped.get(key) ?? [];
    rows.push(getRowNumber(record));
    grouped.set(key, rows);
  }
  return [...grouped.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows }));
}

function parseCompanies(
  table: SpreadsheetTable,
  columns: ResolvedColumns,
) {
  return table.rows.map((row, rowIndex): CompanySource => {
    const rowNumber = rowIndex + 2;
    const rawBillingEmail = normalizeEmail(cell(row, columns.billingEmail));
    const billingEmailValid =
      rawBillingEmail === undefined || isValidEmail(rawBillingEmail);
    const parsedPo = parseBoolean(cell(row, columns.poNumberRequired));
    const hubspotId = normalizeHubspotId(cell(row, columns.hubspotId));
    const name = cleanText(cell(row, columns.name));

    if (!name) {
      review.unnamedCompanies.push({ rowNumber, hubspotId });
    }
    if (!billingEmailValid) {
      review.malformedEmails.push({
        entity: "company",
        rowNumber,
        hubspotId,
        field: "Billing Email Address",
        value: rawBillingEmail,
      });
    }
    if (rawBillingEmail && billingEmailValid) {
      const domain = emailDomain(rawBillingEmail);
      if (domain && GENERIC_OR_RELAY_DOMAINS.has(domain)) {
        review.genericOrRelayEmails.push({
          entity: "company",
          rowNumber,
          hubspotId,
          field: "Billing Email Address",
          email: rawBillingEmail,
          domain,
          unsuitableForCompanyMatching: true,
          unsuitableForMarketing: domain === "wixforms.com",
        });
      }
    }
    if (!parsedPo.valid) {
      review.invalidBooleans.push({
        entity: "company",
        rowNumber,
        hubspotId,
        field: "PO Number Required?",
        value: parsedPo.raw,
      });
    }

    const website = cleanText(cell(row, columns.website));
    return {
      rowNumber,
      hubspotId,
      name,
      website,
      domain: normalizeDomain(website),
      billingAddress: cleanText(cell(row, columns.billingAddress)),
      billingEmail: billingEmailValid ? rawBillingEmail : undefined,
      billingNotes: cleanText(cell(row, columns.billingNotes)),
      notes: cleanText(cell(row, columns.notes)),
      poNumberRequired: parsedPo.value,
    };
  });
}

function parseContacts(
  table: SpreadsheetTable,
  columns: ResolvedColumns,
) {
  return table.rows.map((row, rowIndex): ContactSource => {
    const rowNumber = rowIndex + 2;
    const hubspotId = normalizeHubspotId(cell(row, columns.hubspotId));
    const email = normalizeEmail(cell(row, columns.email));
    const emailIsValid = email === undefined || isValidEmail(email);
    const domain = emailDomain(email);
    const firstName = cleanText(cell(row, columns.firstName));
    const lastName = cleanText(cell(row, columns.lastName));
    const phone = cleanText(cell(row, columns.phone));

    if (!emailIsValid) {
      review.malformedEmails.push({
        entity: "contact",
        rowNumber,
        hubspotId,
        field: "Email",
        value: email,
      });
    }
    if (email && emailIsValid && domain && GENERIC_OR_RELAY_DOMAINS.has(domain)) {
      review.genericOrRelayEmails.push({
        entity: "contact",
        rowNumber,
        hubspotId,
        email,
        domain,
        unsuitableForCompanyMatching: true,
        unsuitableForAutomaticIdentityMatching: domain === "wixforms.com",
        unsuitableForMarketing: domain === "wixforms.com",
      });
    }

    const validEmail = emailIsValid && Boolean(email);
    const hasEnoughIdentity = Boolean(
      validEmail ||
        (firstName && lastName) ||
        ((firstName || lastName) && phone),
    );

    return {
      rowNumber,
      hubspotId,
      firstName,
      lastName,
      email: emailIsValid ? email : undefined,
      emailIsValid,
      emailDomain: domain,
      phone,
      role: cleanText(cell(row, columns.role)),
      contactType: cleanText(cell(row, columns.contactType)),
      lifecycleStage: cleanText(cell(row, columns.lifecycleStage)),
      leadStatus: cleanText(cell(row, columns.leadStatus)),
      source: cleanText(cell(row, columns.source)),
      status: cleanText(cell(row, columns.status)),
      notes: cleanText(cell(row, columns.notes)),
      companyName: cleanText(cell(row, columns.companyName)),
      associatedCompanyIds: splitAssociationIds(
        cell(row, columns.associatedCompanyIds),
      ),
      primaryAssociatedCompanyIds: splitAssociationIds(
        cell(row, columns.primaryAssociatedCompanyIds),
      ),
      hasEnoughIdentity,
    };
  });
}

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createImportClient() {
  const supabaseUrl = getRequiredEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const serviceRoleKey = getRequiredEnvironmentVariable(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Could not read ${table}: ${error.message}`);
    }
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function addToIndex<T>(map: Map<string, T[]>, key: string | undefined, value: T) {
  if (!key) return;
  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
}

function changedPayload(existing: JsonRecord, payload: JsonRecord) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => existing[key] !== value),
  );
}

function companyPayload(source: CompanySource) {
  return Object.fromEntries(
    Object.entries({
      hubspot_id: source.hubspotId,
      name: source.name,
      website: source.website,
      billing_address: source.billingAddress,
      billing_email: source.billingEmail,
      billing_notes: source.billingNotes,
      notes: source.notes,
      po_number_required: source.poNumberRequired,
      imported_from: IMPORT_SOURCE,
    }).filter(([, value]) => value !== undefined),
  );
}

function contactPayload(
  source: ContactSource,
  resolvedCompanyId: string | undefined,
) {
  return Object.fromEntries(
    Object.entries({
      hubspot_id: source.hubspotId,
      company_id: resolvedCompanyId,
      first_name: source.firstName,
      last_name: source.lastName,
      email: source.email,
      phone: source.phone,
      role: source.role,
      contact_type: source.contactType,
      lifecycle_stage: source.lifecycleStage,
      lead_status: source.leadStatus,
      source: source.source,
      status: source.status,
      notes: source.notes,
    }).filter(([, value]) => value !== undefined),
  );
}

function planCompanies(
  sources: CompanySource[],
  existingCompanies: ExistingCompany[],
  duplicateHubspotIds: Set<string>,
) {
  const byHubspotId = new Map<string, ExistingCompany[]>();
  const byDomain = new Map<string, ExistingCompany[]>();
  const byName = new Map<string, ExistingCompany[]>();

  for (const company of existingCompanies) {
    addToIndex(byHubspotId, normalizeHubspotId(company.hubspot_id), company);
    const domain = normalizeDomain(company.website);
    if (domain && !GENERIC_OR_RELAY_DOMAINS.has(domain)) {
      addToIndex(byDomain, domain, company);
    }
    addToIndex(byName, normalizeName(company.name), company);
  }

  return sources.map((source): CompanyAction => {
    if (!source.hubspotId) {
      const reason = "Missing HubSpot company ID.";
      review.skippedRows.push({
        entity: "company",
        rowNumber: source.rowNumber,
        reason,
      });
      return { kind: "skip", source, payload: {}, reason };
    }

    if (duplicateHubspotIds.has(source.hubspotId)) {
      const reason = "Duplicate HubSpot company ID in source workbook.";
      review.skippedRows.push({
        entity: "company",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        reason,
      });
      return { kind: "skip", source, payload: {}, reason };
    }

    const idMatches = byHubspotId.get(source.hubspotId) ?? [];
    if (idMatches.length > 1) {
      const reason = "HubSpot company ID matches multiple existing CRM rows.";
      review.conflicts.push({
        entity: "company",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        existingIds: idMatches.map((company) => company.id),
        reason,
      });
      return { kind: "conflict", source, payload: {}, reason };
    }

    const desired = companyPayload(source);
    if (idMatches.length === 1) {
      const existing = idMatches[0];
      const payload = changedPayload(existing as unknown as JsonRecord, desired);
      return {
        kind: Object.keys(payload).length ? "update" : "noop",
        source,
        payload,
        existing,
        reason: "Matched exact HubSpot company ID.",
      };
    }

    if (source.domain && !GENERIC_OR_RELAY_DOMAINS.has(source.domain)) {
      const domainMatches = byDomain.get(source.domain) ?? [];
      if (domainMatches.length > 1) {
        const reason = "Verified domain matches multiple existing companies.";
        review.conflicts.push({
          entity: "company",
          rowNumber: source.rowNumber,
          hubspotId: source.hubspotId,
          domain: source.domain,
          existingIds: domainMatches.map((company) => company.id),
          reason,
        });
        return { kind: "conflict", source, payload: {}, reason };
      }
      if (domainMatches.length === 1) {
        const existing = domainMatches[0];
        if (
          existing.hubspot_id &&
          normalizeHubspotId(existing.hubspot_id) !== source.hubspotId
        ) {
          const reason =
            "Verified domain match already has a different HubSpot company ID.";
          review.conflicts.push({
            entity: "company",
            rowNumber: source.rowNumber,
            hubspotId: source.hubspotId,
            domain: source.domain,
            existingId: existing.id,
            existingHubspotId: existing.hubspot_id,
            reason,
          });
          return { kind: "conflict", source, payload: {}, reason };
        }
        const payload = changedPayload(
          existing as unknown as JsonRecord,
          desired,
        );
        return {
          kind: Object.keys(payload).length ? "update" : "noop",
          source,
          payload,
          existing,
          reason: "Matched one existing company by verified website domain.",
        };
      }
    }

    const nameMatches = source.name
      ? byName.get(normalizeName(source.name) ?? "") ?? []
      : [];
    if (nameMatches.length) {
      const reason =
        "Normalised company name is only a review suggestion; no automatic match was made.";
      review.companyNameSuggestions.push({
        entity: "company",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        sourceName: source.name,
        existingCompanies: nameMatches.map((company) => ({
          id: company.id,
          hubspotId: company.hubspot_id,
          name: company.name,
        })),
        action: "skipped_to_avoid_possible_duplicate",
      });
      review.skippedRows.push({
        entity: "company",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        reason,
      });
      return { kind: "skip", source, payload: {}, reason };
    }

    if (!source.name) {
      const reason = "Unnamed company cannot be inserted safely.";
      review.skippedRows.push({
        entity: "company",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        reason,
      });
      return { kind: "skip", source, payload: {}, reason };
    }

    return {
      kind: "insert",
      source,
      payload: desired,
      reason: "No exact ID or verified-domain match.",
    };
  });
}

function initialCompanyIdMap(existingCompanies: ExistingCompany[]) {
  const grouped = new Map<string, ExistingCompany[]>();
  for (const company of existingCompanies) {
    addToIndex(grouped, normalizeHubspotId(company.hubspot_id), company);
  }
  return new Map(
    [...grouped.entries()]
      .filter(([, companies]) => companies.length === 1)
      .map(([hubspotId, companies]) => [hubspotId, companies[0].id]),
  );
}

async function applyCompanyActions(
  supabase: SupabaseClient,
  actions: CompanyAction[],
  companyIdByHubspotId: Map<string, string>,
  mode: ImportMode,
) {
  let inserted = 0;
  let updated = 0;

  for (const [index, action] of actions.entries()) {
    const hubspotId = action.source.hubspotId;
    if (!hubspotId) continue;

    if (action.kind === "noop" && action.existing) {
      companyIdByHubspotId.set(hubspotId, action.existing.id);
      continue;
    }
    if (action.kind === "skip" || action.kind === "conflict") continue;

    if (mode === "dry-run") {
      companyIdByHubspotId.set(
        hubspotId,
        action.existing?.id ?? `planned:${hubspotId}`,
      );
      continue;
    }

    const query =
      action.kind === "insert"
        ? supabase.from("companies").insert(action.payload)
        : supabase
            .from("companies")
            .update(action.payload)
            .eq("id", action.existing?.id ?? "");
    const { data, error } = await query.select("id").single();

    if (error || !data?.id) {
      review.writeErrors.push({
        entity: "company",
        rowNumber: action.source.rowNumber,
        hubspotId,
        action: action.kind,
        error: error?.message ?? "No company ID returned.",
      });
    } else {
      companyIdByHubspotId.set(hubspotId, data.id as string);
      if (action.kind === "insert") inserted += 1;
      if (action.kind === "update") updated += 1;
    }

    if ((index + 1) % 100 === 0 || index + 1 === actions.length) {
      console.log(`Companies committed: ${index + 1}/${actions.length}`);
    }
  }

  return { inserted, updated };
}

function companySuggestionIndex(
  companySources: CompanySource[],
  existingCompanies: ExistingCompany[],
) {
  const suggestions = new Map<
    string,
    { id?: string; hubspotId?: string; name?: string }[]
  >();
  for (const company of companySources) {
    const key = normalizeName(company.name);
    if (!key) continue;
    const values = suggestions.get(key) ?? [];
    values.push({
      hubspotId: company.hubspotId,
      name: company.name,
    });
    suggestions.set(key, values);
  }
  for (const company of existingCompanies) {
    const key = normalizeName(company.name);
    if (!key) continue;
    const values = suggestions.get(key) ?? [];
    if (!values.some((value) => value.id === company.id)) {
      values.push({
        id: company.id,
        hubspotId: company.hubspot_id ?? undefined,
        name: company.name ?? undefined,
      });
    }
    suggestions.set(key, values);
  }
  return suggestions;
}

function resolveContactCompany(
  source: ContactSource,
  companyIdByHubspotId: Map<string, string>,
  suggestionsByName: ReturnType<typeof companySuggestionIndex>,
) {
  let selectedHubspotId: string | undefined;
  let reason: string | undefined;

  if (source.primaryAssociatedCompanyIds.length > 1) {
    reason = "Multiple primary associated-company IDs.";
  } else if (source.primaryAssociatedCompanyIds.length === 1) {
    selectedHubspotId = source.primaryAssociatedCompanyIds[0];
  } else if (source.associatedCompanyIds.length > 1) {
    reason =
      "Multiple associated-company IDs and no single primary association.";
  } else if (source.associatedCompanyIds.length === 1) {
    selectedHubspotId = source.associatedCompanyIds[0];
  } else {
    reason = "No associated-company ID in the HubSpot export.";
  }

  if (reason?.startsWith("Multiple")) {
    review.ambiguousAssociations.push({
      rowNumber: source.rowNumber,
      hubspotId: source.hubspotId,
      primaryAssociatedCompanyIds: source.primaryAssociatedCompanyIds,
      associatedCompanyIds: source.associatedCompanyIds,
      reason,
    });
  }

  const resolvedCompanyId = selectedHubspotId
    ? companyIdByHubspotId.get(selectedHubspotId)
    : undefined;

  if (!resolvedCompanyId) {
    const nameSuggestions = source.companyName
      ? suggestionsByName.get(normalizeName(source.companyName) ?? "") ?? []
      : [];
    review.unmatchedContacts.push({
      rowNumber: source.rowNumber,
      hubspotId: source.hubspotId,
      email: source.email,
      associatedHubspotCompanyId: selectedHubspotId,
      freeTextCompanyName: source.companyName,
      reviewOnlyNameSuggestions: nameSuggestions.slice(0, 10),
      reason:
        reason ??
        "Associated HubSpot company ID was not found in an imported or existing CRM company.",
    });
  }

  return {
    associatedHubspotCompanyId: selectedHubspotId,
    resolvedCompanyId,
  };
}

function planContacts(
  sources: ContactSource[],
  existingContacts: ExistingContact[],
  duplicateHubspotIds: Set<string>,
  duplicateEmails: Set<string>,
  companyIdByHubspotId: Map<string, string>,
  suggestionsByName: ReturnType<typeof companySuggestionIndex>,
) {
  const byHubspotId = new Map<string, ExistingContact[]>();
  const byEmail = new Map<string, ExistingContact[]>();
  for (const contact of existingContacts) {
    addToIndex(byHubspotId, normalizeHubspotId(contact.hubspot_id), contact);
    addToIndex(byEmail, normalizeEmail(contact.email), contact);
  }

  return sources.map((source): ContactAction => {
    const association = resolveContactCompany(
      source,
      companyIdByHubspotId,
      suggestionsByName,
    );

    if (!source.hubspotId) {
      const reason = "Missing HubSpot contact ID.";
      review.skippedRows.push({
        entity: "contact",
        rowNumber: source.rowNumber,
        reason,
      });
      return {
        kind: "skip",
        source,
        payload: {},
        reason,
        ...association,
      };
    }

    const duplicateReasons: string[] = [];
    if (duplicateHubspotIds.has(source.hubspotId)) {
      duplicateReasons.push("duplicate HubSpot contact ID");
    }
    if (source.email && duplicateEmails.has(source.email)) {
      duplicateReasons.push("duplicate normalised email");
    }
    if (duplicateReasons.length) {
      const reason = `Source workbook has ${duplicateReasons.join(" and ")}.`;
      review.skippedRows.push({
        entity: "contact",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        email: source.email,
        reason,
      });
      return {
        kind: "skip",
        source,
        payload: {},
        reason,
        ...association,
      };
    }

    const idMatches = byHubspotId.get(source.hubspotId) ?? [];
    const emailMatches = source.email
      ? byEmail.get(source.email) ?? []
      : [];

    if (idMatches.length > 1 || emailMatches.length > 1) {
      const reason =
        "A source identifier matches multiple existing CRM contacts.";
      review.conflicts.push({
        entity: "contact",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        email: source.email,
        hubspotMatchIds: idMatches.map((contact) => contact.id),
        emailMatchIds: emailMatches.map((contact) => contact.id),
        reason,
      });
      return {
        kind: "conflict",
        source,
        payload: {},
        reason,
        ...association,
      };
    }

    const idMatch = idMatches[0];
    const emailMatch = emailMatches[0];
    if (idMatch && emailMatch && idMatch.id !== emailMatch.id) {
      const reason =
        "HubSpot contact ID and normalised email match different existing CRM records.";
      review.conflicts.push({
        entity: "contact",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        email: source.email,
        hubspotMatchId: idMatch.id,
        emailMatchId: emailMatch.id,
        reason,
      });
      return {
        kind: "conflict",
        source,
        payload: {},
        reason,
        ...association,
      };
    }

    let existing = idMatch;
    let matchReason = "Matched exact HubSpot contact ID.";
    if (!existing && emailMatch) {
      if (source.emailDomain === "wixforms.com") {
        const reason =
          "Wix relay email already exists but is unsuitable for automatic identity matching.";
        review.conflicts.push({
          entity: "contact",
          rowNumber: source.rowNumber,
          hubspotId: source.hubspotId,
          email: source.email,
          emailMatchId: emailMatch.id,
          reason,
        });
        return {
          kind: "conflict",
          source,
          payload: {},
          reason,
          ...association,
        };
      }
      if (
        emailMatch.hubspot_id &&
        normalizeHubspotId(emailMatch.hubspot_id) !== source.hubspotId
      ) {
        const reason =
          "Normalised email match already has a different HubSpot contact ID.";
        review.conflicts.push({
          entity: "contact",
          rowNumber: source.rowNumber,
          hubspotId: source.hubspotId,
          email: source.email,
          emailMatchId: emailMatch.id,
          existingHubspotId: emailMatch.hubspot_id,
          reason,
        });
        return {
          kind: "conflict",
          source,
          payload: {},
          reason,
          ...association,
        };
      }
      existing = emailMatch;
      matchReason = "Matched exact normalised email.";
    }

    if (!existing && !source.hasEnoughIdentity) {
      const reason =
        "Not enough valid identity information to create a contact.";
      review.skippedRows.push({
        entity: "contact",
        rowNumber: source.rowNumber,
        hubspotId: source.hubspotId,
        reason,
      });
      return {
        kind: "skip",
        source,
        payload: {},
        reason,
        ...association,
      };
    }

    const desired = contactPayload(source, association.resolvedCompanyId);
    if (existing) {
      const payload = changedPayload(
        existing as unknown as JsonRecord,
        desired,
      );
      return {
        kind: Object.keys(payload).length ? "update" : "noop",
        source,
        payload,
        existing,
        reason: matchReason,
        ...association,
      };
    }

    return {
      kind: "insert",
      source,
      payload: desired,
      reason: "No exact HubSpot ID or permitted email match.",
      ...association,
    };
  });
}

async function applyContactActions(
  supabase: SupabaseClient,
  actions: ContactAction[],
  mode: ImportMode,
) {
  let inserted = 0;
  let updated = 0;

  if (mode === "dry-run") return { inserted, updated };

  for (const [index, action] of actions.entries()) {
    if (
      action.kind === "noop" ||
      action.kind === "skip" ||
      action.kind === "conflict"
    ) {
      continue;
    }

    const query =
      action.kind === "insert"
        ? supabase.from("contacts").insert(action.payload)
        : supabase
            .from("contacts")
            .update(action.payload)
            .eq("id", action.existing?.id ?? "");
    const { data, error } = await query.select("id").single();

    if (error || !data?.id) {
      review.writeErrors.push({
        entity: "contact",
        rowNumber: action.source.rowNumber,
        hubspotId: action.source.hubspotId,
        email: action.source.email,
        action: action.kind,
        error: error?.message ?? "No contact ID returned.",
      });
    } else {
      if (action.kind === "insert") inserted += 1;
      if (action.kind === "update") updated += 1;
    }

    if ((index + 1) % 100 === 0 || index + 1 === actions.length) {
      console.log(`Contacts committed: ${index + 1}/${actions.length}`);
    }
  }

  return { inserted, updated };
}

function countActions(actions: { kind: ActionKind }[], kind: ActionKind) {
  return actions.filter((action) => action.kind === kind).length;
}

function relativeToWorkspace(filePath: string) {
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith("..") ? filePath : relative;
}

async function writeReport(reportPath: string, report: JsonRecord) {
  await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.promises.writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

function printSummary(summary: JsonRecord, reportPath: string) {
  console.log("\nHubSpot import review");
  for (const [label, value] of Object.entries(summary)) {
    console.log(`${label}: ${String(value)}`);
  }
  console.log(`reviewReport: ${reportPath}`);
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  loadEnvConfig(process.cwd());

  const companyTable = readSpreadsheet(options.companiesPath, [
    "Record ID",
    "Company name",
  ]);
  const contactTable = readSpreadsheet(options.contactsPath, [
    "Record ID",
    "First Name",
    "Last Name",
    "Email",
  ]);

  const companyColumns = resolveColumns(companyTable, COMPANY_COLUMN_SPECS);
  const contactColumns = resolveColumns(contactTable, CONTACT_COLUMN_SPECS);
  if (
    !contactColumns.resolved.associatedCompanyIds &&
    !contactColumns.resolved.primaryAssociatedCompanyIds
  ) {
    throw new Error(
      "The contact workbook has no validated associated-company ID heading.",
    );
  }

  const companySources = parseCompanies(
    companyTable,
    companyColumns.resolved,
  );
  const contactSources = parseContacts(
    contactTable,
    contactColumns.resolved,
  );

  const duplicateCompanyIds = findDuplicateGroups(
    companySources,
    (company) => company.hubspotId,
    (company) => company.rowNumber,
  );
  const duplicateContactIds = findDuplicateGroups(
    contactSources,
    (contact) => contact.hubspotId,
    (contact) => contact.rowNumber,
  );
  const duplicateContactEmails = findDuplicateGroups(
    contactSources,
    (contact) => contact.email,
    (contact) => contact.rowNumber,
  );
  review.duplicateHubspotIds.push(
    ...duplicateCompanyIds.map((group) => ({
      entity: "company",
      hubspotId: group.key,
      rows: group.rows,
    })),
    ...duplicateContactIds.map((group) => ({
      entity: "contact",
      hubspotId: group.key,
      rows: group.rows,
    })),
  );
  review.duplicateNormalizedEmails.push(
    ...duplicateContactEmails.map((group) => ({
      email: group.key,
      rows: group.rows,
    })),
  );

  const supabase = createImportClient();
  const [existingCompanies, existingContacts] = await Promise.all([
    fetchAllRows<ExistingCompany>(
      supabase,
      "companies",
      [
        "id",
        "hubspot_id",
        "name",
        "website",
        "billing_address",
        "billing_email",
        "billing_notes",
        "notes",
        "po_number_required",
        "imported_from",
      ].join(","),
    ),
    fetchAllRows<ExistingContact>(
      supabase,
      "contacts",
      [
        "id",
        "company_id",
        "hubspot_id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "role",
        "contact_type",
        "lifecycle_stage",
        "lead_status",
        "source",
        "status",
        "notes",
      ].join(","),
    ),
  ]);

  const companyActions = planCompanies(
    companySources,
    existingCompanies,
    new Set(duplicateCompanyIds.map((group) => group.key)),
  );
  const companyIdByHubspotId = initialCompanyIdMap(existingCompanies);
  const companyCommit = await applyCompanyActions(
    supabase,
    companyActions,
    companyIdByHubspotId,
    options.mode,
  );

  const contactActions = planContacts(
    contactSources,
    existingContacts,
    new Set(duplicateContactIds.map((group) => group.key)),
    new Set(duplicateContactEmails.map((group) => group.key)),
    companyIdByHubspotId,
    companySuggestionIndex(companySources, existingCompanies),
  );
  const contactCommit = await applyContactActions(
    supabase,
    contactActions,
    options.mode,
  );

  const actionableContactActions = contactActions.filter(
    (action) => action.kind !== "skip" && action.kind !== "conflict",
  );
  const summary = {
    mode: options.mode,
    companiesRead: companySources.length,
    contactsRead: contactSources.length,
    validCompanies: companySources.filter(
      (company) => company.hubspotId && company.name,
    ).length,
    validContacts: contactSources.filter(
      (contact) => contact.hubspotId && contact.hasEnoughIdentity,
    ).length,
    companiesWouldInsert: countActions(companyActions, "insert"),
    companiesWouldUpdate: countActions(companyActions, "update"),
    contactsWouldInsert: countActions(contactActions, "insert"),
    contactsWouldUpdate: countActions(contactActions, "update"),
    companiesUnchanged: countActions(companyActions, "noop"),
    contactsUnchanged: countActions(contactActions, "noop"),
    contactsLinkedToCompanies: actionableContactActions.filter(
      (action) => action.resolvedCompanyId,
    ).length,
    contactsWithoutCompanies: actionableContactActions.filter(
      (action) => !action.resolvedCompanyId,
    ).length,
    rowsSkipped:
      countActions(companyActions, "skip") +
      countActions(companyActions, "conflict") +
      countActions(contactActions, "skip") +
      countActions(contactActions, "conflict"),
    duplicateHubspotIds: review.duplicateHubspotIds.length,
    duplicateHubspotIdRows: review.duplicateHubspotIds.reduce(
      (total, item) =>
        total + (Array.isArray(item.rows) ? item.rows.length : 0),
      0,
    ),
    duplicateNormalizedEmails: review.duplicateNormalizedEmails.length,
    duplicateNormalizedEmailRows: review.duplicateNormalizedEmails.reduce(
      (total, item) =>
        total + (Array.isArray(item.rows) ? item.rows.length : 0),
      0,
    ),
    conflictingExistingRecords: review.conflicts.length,
    genericOrRelayEmailRows: review.genericOrRelayEmails.length,
    genericOrRelayEmailDomains: new Set(
      review.genericOrRelayEmails
        .map((item) => item.domain)
        .filter((domain): domain is string => typeof domain === "string"),
    ).size,
    unnamedCompanies: review.unnamedCompanies.length,
    malformedEmails: review.malformedEmails.length,
    ambiguousCompanyAssociations: review.ambiguousAssociations.length,
    unmappedCompanyColumns: companyColumns.unmappedColumns.length,
    unmappedContactColumns: contactColumns.unmappedColumns.length,
    companiesInserted: companyCommit.inserted,
    companiesUpdated: companyCommit.updated,
    contactsInserted: contactCommit.inserted,
    contactsUpdated: contactCommit.updated,
    writeErrors: review.writeErrors.length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    safety: {
      dryRunPerformedNoWrites: options.mode === "dry-run",
      serviceRoleKeyIncludedInReport: false,
      automaticNameMatching: false,
      contactNameIdentityMatching: false,
      runsDuringBuildOrStartup: false,
    },
    sources: {
      companies: {
        file: relativeToWorkspace(companyTable.filePath),
        worksheetNamesInspected: companyTable.sheetNames,
        selectedWorksheet: companyTable.sheetName,
        rowCount: companySources.length,
        mappedColumns: companyColumns.mappedColumns,
        unmappedColumns: companyColumns.unmappedColumns,
      },
      contacts: {
        file: relativeToWorkspace(contactTable.filePath),
        worksheetNamesInspected: contactTable.sheetNames,
        selectedWorksheet: contactTable.sheetName,
        rowCount: contactSources.length,
        mappedColumns: contactColumns.mappedColumns,
        unmappedColumns: contactColumns.unmappedColumns,
      },
    },
    existingCrmRowsInspected: {
      companies: existingCompanies.length,
      contacts: existingContacts.length,
    },
    summary,
    review,
  };

  await writeReport(options.reportPath, report);
  printSummary(summary, options.reportPath);

  if (review.writeErrors.length) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`HubSpot import failed: ${message}`);
  process.exitCode = 1;
});
