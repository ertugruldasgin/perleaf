type Props = {
  project: string;
  name: string;
  hash: string;
};

export function AssetView({ project, name, hash }: Props) {
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
        src={`/api/projects/${project}/blobs/${hash}`}
        alt={name}
        className="max-h-full max-w-full"
      />
    </div>
  );
}
