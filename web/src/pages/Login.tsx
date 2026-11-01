export function Login() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-200 bg-white px-10 py-8 shadow-sm">
        <h1 className="text-lg font-semibold">latex-editor</h1>
        <p className="text-sm text-neutral-500">Collaborative LaTeX editing</p>
        <a
          href={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Sign in with GitHub
        </a>
      </div>
    </div>
  );
}
