import { InboxPageContent } from "./_components/inbox-page";

type InboxPageProps = {
  searchParams: Promise<{
    q?: string;
    source?: string;
    page?: string;
    clientType?: string;
    sort?: string;
    view?: string;
  }>;
};

export default function InboxPage({ searchParams }: InboxPageProps) {
  return <InboxPageContent searchParams={searchParams} />;
}
