import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card p-6">
        <h1 className="text-lg font-semibold">Spreadsheet Diary</h1>
        <p className="mb-4 text-sm text-muted">Enter the app password to continue.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
