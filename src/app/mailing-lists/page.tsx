import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatStatus } from "@/lib/format";
import { createMailingList } from "./actions";

type MailingListRecord = {
  id: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  mailing_list_contacts?: { contact_id?: string | null }[] | null;
};

type ContactRecord = {
  id: string;
  mailing_status?: string | null;
};

export default async function MailingListsPage() {
  const [{ data: listData, error: listError }, { data: contactData }] = await Promise.all([
    supabase
      .from("mailing_lists")
      .select(`
        id,
        name,
        description,
        status,
        mailing_list_contacts (
          contact_id
        )
      `)
      .order("name"),
    supabase
      .from("contacts")
      .select("id, mailing_status")
      .order("created_at", { ascending: false }),
  ]);

  if (listError) {
    return (
      <div className="grid gap-8">
        <header>
          <h1 className="crm-page-title">Mailing lists</h1>
        </header>

        <section className="crm-card p-6">
          <h2 className="crm-section-title">Supabase tables needed</h2>
          <p className="crm-muted mt-2">
            Run <span className="font-bold">supabase/contact-crm-schema.sql</span> in Supabase,
            then refresh this page.
          </p>
        </section>
      </div>
    );
  }

  const mailingLists = (listData ?? []) as MailingListRecord[];
  const contacts = (contactData ?? []) as ContactRecord[];
  const subscribedCount = contacts.filter((contact) => contact.mailing_status === "subscribed").length;
  const doNotContactCount = contacts.filter(
    (contact) => contact.mailing_status === "do_not_contact",
  ).length;
  const totalMembers = new Set(
    mailingLists.flatMap((list) =>
      (list.mailing_list_contacts ?? [])
        .map((member) => member.contact_id)
        .filter((contactId): contactId is string => Boolean(contactId)),
    ),
  ).size;

  const audienceCards = [
    {
      title: "Lists",
      count: mailingLists.length,
      className: "",
    },
    {
      title: "Contacts in lists",
      count: totalMembers,
      className: "crm-kpi-yellow",
    },
    {
      title: "Subscribed",
      count: subscribedCount,
      className: "crm-kpi-orange",
    },
    {
      title: "Do not contact",
      count: doNotContactCount,
      className: "",
    },
  ];

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="crm-page-title">Mailing lists</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {audienceCards.map((card) => (
          <div className={`crm-card crm-kpi p-5 ${card.className}`} key={card.title}>
            <p className="crm-muted font-bold">{card.title}</p>
            <p className="mt-3 text-4xl font-black">{card.count}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <form action={createMailingList} className="crm-card grid gap-5 p-6">
          <h2 className="crm-section-title">Create mailing list</h2>

          <label className="grid gap-2 font-bold">
            <span>List name</span>
            <input className="crm-input" name="name" placeholder="Newsletter" required />
          </label>

          <label className="grid gap-2 font-bold">
            <span>Status</span>
            <select className="crm-input" defaultValue="active" name="status">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="grid gap-2 font-bold">
            <span>Description</span>
            <textarea
              className="crm-input min-h-28"
              name="description"
              placeholder="Audience purpose or notes"
            />
          </label>

          <button className="crm-button crm-button-primary mt-2 w-full" type="submit">
            Create list
          </button>
        </form>

        <section className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">Lists</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contacts</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mailingLists.map((list) => (
                  <tr key={list.id}>
                    <td>
                      <div className="grid gap-1">
                        <Link className="font-bold underline" href={`/mailing-lists/${list.id}`}>
                          {list.name}
                        </Link>
                        {list.description && (
                          <span className="crm-muted text-sm">{list.description}</span>
                        )}
                      </div>
                    </td>
                    <td>{list.mailing_list_contacts?.length ?? 0}</td>
                    <td>
                      <span className="crm-status-pill">{formatStatus(list.status)}</span>
                    </td>
                  </tr>
                ))}

                {!mailingLists.length && (
                  <tr>
                    <td colSpan={3}>No mailing lists yet.</td>
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
