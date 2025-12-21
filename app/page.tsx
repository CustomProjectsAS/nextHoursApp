import { Button } from "@/components/ui/button";
import Link from "next/link";


export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">CP Hours</h1>
          <Button variant="outline" size="sm">
            Log in
          </Button>
        </header>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">Welcome</h2>
          <p className="text-sm text-muted-foreground">
            This is the new version of your Hours app. Next steps: add employee and
            admin views here.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold">Employee</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Simple screen for workers to register hours from phone or PC.
            </p>
            <Button className="w-full" asChild>
              <Link href="/employee">Open employee view</Link>
            </Button>

          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold">Admin</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Overview of hours, projects and confirmations for the company.
            </p>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/admin">Open admin view</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
