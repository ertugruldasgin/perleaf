import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
  type Project,
  type User,
} from "@/api";
import { RenameProjectDialog } from "@/components/RenameProjectDialog";
import { DeleteProjectDialog } from "@/components/DeleteProjectDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn, errorMessage } from "@/lib/utils";
import { AppHeader } from "@/components/AppHeader";

const formatDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function Home({ user }: { user: User }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  const create = async () => {
    try {
      const p = await createProject(name);
      navigate(`/p/${p.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const rename = async (p: Project, next: string) => {
    const updated = await renameProject(p.id, next);
    setProjects((ps) => ps?.map((x) => (x.id === p.id ? updated : x)) ?? null);
    toast.success("Project renamed");
  };

  const remove = async (p: Project) => {
    await deleteProject(p.id);
    setProjects((ps) => ps?.filter((x) => x.id !== p.id) ?? null);
    toast.success(`Deleted "${p.name}"`);
  };

  const iconButton = cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "cursor-pointer",
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Create a project or open one you're a member of.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="mb-8 flex gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name..."
            maxLength={100}
            inputSize="lg"
          />
          <Button size="lg" disabled={!name.trim()}>
            Create
          </Button>
        </form>

        {projects &&
          (projects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first project above.
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center pr-2 transition-colors hover:bg-muted/50"
                >
                  <Link
                    to={`/p/${p.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{p.name}</span>
                    <Badge variant="secondary">{p.role}</Badge>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </span>
                  </Link>

                  {p.role === "owner" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={iconButton}
                        title="Project actions"
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRenaming(p)}>
                          <Pencil />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className={cn(iconButton, "invisible")} />
                  )}
                </li>
              ))}
            </ul>
          ))}
      </main>

      <RenameProjectDialog
        project={renaming}
        onClose={() => setRenaming(null)}
        onRename={rename}
      />
      <DeleteProjectDialog
        project={deleting}
        onClose={() => setDeleting(null)}
        onDelete={remove}
      />
    </div>
  );
}
