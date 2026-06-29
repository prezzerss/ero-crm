import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { updateCompany } from "../../actions";
import { CompanyForm } from "../../_components/company-form";

type EditCompanyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = await params;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (!company) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <header>
        <Link href={`/companies/${id}`} className="font-bold underline">
          Back to client
        </Link>

        <h1 className="crm-page-title mt-6">Edit {company.name}</h1>
      </header>

      <CompanyForm
        action={updateCompany.bind(null, id)}
        cancelHref={`/companies/${id}`}
        company={company}
        mode="edit"
      />
    </div>
  );
}
