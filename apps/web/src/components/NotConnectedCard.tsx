export function NotConnectedCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-linen p-6 text-center">
      <p className="text-sm font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
