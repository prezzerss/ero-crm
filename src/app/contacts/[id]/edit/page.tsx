import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { updateContact } from "../../actions";
import { ContactForm } from "../../_components/contact-form";
import { getCompanyOptions, getContactTagIds, getTagOptions } from "../../data";

type EditContactPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getFullName(contact: { first_name?: string | null; last_name?: string | null; email?: string | null }) {
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || contact.email || "Unnamed contact";
}

export default async function EditContactPage({ params }: EditContactPageProps) {
  const { id } = await params;

  const [{ data: contact }, companies, tags, selectedTagIds] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).single(),
    getCompanyOptions(),
    getTagOptions(),
    getContactTagIds(id),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <header>
        <Link href={`/contacts/${id}`} className="font-bold underline">
          Back to contact
        </Link>

        <h1 className="crm-page-title mt-6">Edit {getFullName(contact)}</h1>
      </header>

      <ContactForm
        action={updateContact.bind(null, id)}
        cancelHref={`/contacts/${id}`}
        companies={companies}
        contact={contact}
        mode="edit"
        selectedTagIds={selectedTagIds}
        tags={tags}
      />
    </div>
  );
}
