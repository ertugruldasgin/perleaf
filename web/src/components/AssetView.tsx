type Props = {
  name: string;
  hash: string;
};

export function AssetView({ name, hash }: Props) {
  if (name.toLowerCase().endsWith(".pdf")) {
    return (
      <p className="p-3 text-sm text-neutral-500">
        {name} is used when compiling.
      </p>
    );
  }
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-neutral-50 p-4">
      <img
        src={`/blobs/${hash}`}
        alt={name}
        className="max-h-full max-w-full"
      />
    </div>
  );
}
