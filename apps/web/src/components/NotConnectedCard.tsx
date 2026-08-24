export function NotConnectedCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-linen-2 p-6 text-center">
      <p className="font-[family-name:var(--font-fraunces)] text-lg font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
