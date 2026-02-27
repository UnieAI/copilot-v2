import { LoginPage } from "@/components/page/auth/login-page";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    redirectUrl?: string;
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  const redirectUrl = search["redirectUrl"] ?? "";

  return (
      <LoginPage redirectUrl={redirectUrl} />
  );
}
