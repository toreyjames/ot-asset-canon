import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#050915] text-slate-100 px-4 py-12">
      <div className="max-w-md mx-auto rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6">
        <div className="text-xs uppercase tracking-wide text-cyan-300">PlantTrace Control</div>
        <h1 className="mt-2 text-3xl font-semibold">Admin Login</h1>
        <p className="mt-2 text-sm text-slate-300">For internal operators, delivery leads, and platform admins.</p>

        <form className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs text-slate-400">Admin Email</span>
            <input type="email" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="you@planttrace.io" />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400">Password</span>
            <input type="password" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="••••••••" />
          </label>

          <button type="button" className="w-full rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
            Sign In As Admin
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-400">Use your internal credentials and approved access role.</div>
        <div className="mt-6 text-xs">
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">Return Home</Link>
        </div>
      </div>
    </div>
  );
}
