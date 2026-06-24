import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";
import { addContactToMailingList, removeContactFromMailingList } from "../actions";

type CompanyRecord = {
  id?: string | null;
  name?: string | null;
};

type ContactRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  mailing_status?: string | null;
  companies?: CompanyRecord | CompanyRecord[] | null;
};

type MemberRecord = {
  contact_id?: string | null;
  contacts?: ContactRecord | ContactRecord[] | null;
};

type MailingListRecord = {
  id: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  mailing_list_contacts?: MemberRecord[] | null;
};

type MailingListDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getCompany(contact: ContactRecord) {
  if (Array.isArray(contact.companies)) {
    return contact.companies[0] ?? null;
  }

  return contact.companies ?? null;
}

function getMemberContact(member: MemberRecord) {
  if (Array.isArray(member.contacts)) {
    return member.contacts[0] ?? null;
  }

  return member.contacts ?? null;
}

function getFullName(contact: ContactRecord) {
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || contact.email || "Unnamed contact";
}

export default async function MailingListDetailPage({ params }: MailingListDetailPageProps) {
  const { id } = await params;

  const [{ data: mailingList }, { data: contactData }] = await Promise.all([
    supabase
      .from("mailing_lists")
      .select(`
        id,
        name,
        description,
        status,
        mailing_list_contacts (
          contact_id,
          contacts (
            id,
            first_name,
            last_name,
            email,
            role,
            mailing_status,
            companies (
              id,
              name
            )
          )
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("contacts")
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        mailing_status,
        companies (
          id,
          name
        )
      `)
      .order("first_name"),
  ]);

  if (!mailingList) {
    notFound();
  }

  const typedList = mailingList as MailingListRecord;
  const allContacts = (contactData ?? []) as ContactRecord[];
  const members = (typedList.mailing_list_contacts ?? [])
    .map((member) => getMemberContact(member))
    .filter((contact): contact is ContactRecord => Boolean(contact));
  const memberIds = new Set(members.map((contact) => contact.id));
  const availableContacts = allContacts.filter((contact) => !memberIds.has(contact.id));

  return (
    <div className="grid gap-8">
      <header className="crm-detail-hero p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/mailing-lists" className="font-bold underline">
              Back to mailing lists
            </Link>
            <h1 className="crm-page-title mt-4">{typedList.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="crm-status-pill">{formatStatus(typedList.status)}</span>
              <span className="crm-status-pill crm-status-pill-yellow">
                {members.length} contacts
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <form action={addContactToMailingList.bind(null, id)} className="crm-card crm-form-grid p-6">
          <h2 className="crm-section-title">Add contact</h2>

          <label className="grid gap-2 font-bold">
            <span>Contact</span>
            <select className="crm-input" name="contact_id" required>
              <option value="">Choose contact</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {getFullName(contact)}
                  {contact.email ? ` - ${contact.email}` : ""}
                </option>
              ))}
            </select>
          </label>

          <button className="crm-button crm-button-primary" type="submit">
            Add to list
          </button>

          {!availableContacts.length && (
            <p className="crm-empty">All contacts are already on this list.</p>
          )}
        </form>

        <section className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Contacts</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Mailing</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((contact) => {
                  const company = getCompany(contact);

                  return (
                    <tr key={contact.id}>
                      <td>
                        <div className="grid gap-1">
                          <Link className="font-bold underline" href={`/contacts/${contact.id}`}>
                            {getFullName(contact)}
                          </Link>
                          <span className="crm-muted text-sm">{contact.email || "No email"}</span>
                        </div>
                      </td>
                      <td>
                        {company?.id ? (
                          <Link className="font-bold underline" href={`/companies/${company.id}`}>
                            {company.name}
                          </Link>
                        ) : (
                          "No company"
                        )}
                      </td>
                      <td>
                        <span className="crm-status-pill">
                          {formatStatus(contact.mailing_status, "Unknown")}
                        </span>
                      </td>
                      <td>
                        <form action={removeContactFromMailingList.bind(null, id, contact.id)}>
                          <button className="crm-button" type="submit">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}

                {!members.length && (
                  <tr>
                    <td colSpan={4}>No contacts on this list yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
