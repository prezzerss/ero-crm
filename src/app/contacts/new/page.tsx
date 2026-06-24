import Link from "next/link";
import { createContact } from "../actions";
import { ContactForm } from "../_components/contact-form";
import { getCompanyOptions, getTagOptions } from "../data";

type NewContactPageProps = {
  searchParams: Promise<{
    companyId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    source?: string;
  }>;
};

export default async function NewContactPage({ searchParams }: NewContactPageProps) {
  const params = await searchParams;
  const [companies, tags] = await Promise.all([getCompanyOptions(), getTagOptions()]);

  return (
    <div className="grid gap-8">
      <header>
        <Link href="/contacts" className="font-bold underline">
          Back to contacts
        </Link>

        <h1 className="crm-page-title mt-6">Add contact</h1>
      </header>

      <ContactForm
        action={createContact}
        cancelHref="/contacts"
        companies={companies}
        contact={{
          email: params.email,
          first_name: params.firstName,
          last_name: params.lastName,
          source_inbox: params.source,
        }}
        defaultCompanyId={params.companyId}
        mode="create"
        tags={tags}
      />
    </div>
  );
}
