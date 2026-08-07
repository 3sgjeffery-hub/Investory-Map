import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";

export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/report");
  return <>{children}</>;
}
