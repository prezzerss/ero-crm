import { notFound } from "next/navigation";
import { InboxPageContent } from "../_components/inbox-page";

type SourceKey = "projects" | "quotes" | "enquiries";

type InboxSourcePageProps = {
  params: Promise<{
    source: string;
  }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

const sourceKeys = ["projects", "quotes", "enquiries"];

function isSourceKey(value: string): value is SourceKey {
  return sourceKeys.includes(value);
}

export default async function InboxSourcePage({ params, searchParams }: InboxSourcePageProps) {
  const { source } = await params;

  if (!isSourceKey(source)) {
    notFound();
  }

  return <InboxPageContent searchParams={searchParams} source={source} />;
}
