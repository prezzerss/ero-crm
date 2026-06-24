import Link from "next/link";
import { createCompany } from "../actions";
import { CompanyForm } from "../_components/company-form";

export default function NewCompanyPage() {
  return (
    <div className="grid gap-8">
      <header>
        <Link href="/companies" className="font-bold underline">
          Back to companies
        </Link>

        <h1 className="crm-page-title mt-6">Add company</h1>
      </header>

      <CompanyForm action={createCompany} cancelHref="/companies" mode="create" />
    </div>
  );
}
