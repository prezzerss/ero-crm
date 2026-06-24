import { redirect } from "next/navigation";

type EmailRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmailRedirectPage({ params }: EmailRedirectPageProps) {
  const { id } = await params;

  redirect(`/inbox/message/${id}`);
}
