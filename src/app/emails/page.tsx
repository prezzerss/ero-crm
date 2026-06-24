import { redirect } from "next/navigation";

export default function EmailsRedirectPage() {
  redirect("/inbox");
}
