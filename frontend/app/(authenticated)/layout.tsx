import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { logoutAction } from "@/src/adapters/inbound/next/actions/auth";
import { requireCurrentUser } from "@/src/adapters/inbound/next/session";

const navigation = [
  { href: "/", label: "Upload" },
  { href: "/speeches", label: "Speeches" },
  { href: "/analytics", label: "Analytics" },
  { href: "/account", label: "Account" },
] as const;

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="font-semibold tracking-tight">
            Grammar Tracker
          </Link>
          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="Main navigation"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {item.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <Button variant="secondary" size="sm" type="submit">
                Logout
              </Button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
