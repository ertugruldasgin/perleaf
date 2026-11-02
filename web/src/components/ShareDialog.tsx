import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Check, Clock, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  createInvite,
  listMembers,
  removeMember,
  type Member,
  type Project,
  type User,
} from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
  user: User;
};

export function ShareDialog({ open, onClose, project, user }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="truncate">
            Share{" "}
            <span className="font-normal text-muted-foreground">
              {project.name}
            </span>
          </DialogTitle>
        </DialogHeader>
        {open && <ShareContent project={project} user={user} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareContent({ project, user }: { project: Project; user: User }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [link, setLink] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const isOwner = project.role === "owner";

  useEffect(() => {
    listMembers(project.id)
      .then(setMembers)
      .catch((err) => toast.error(errorMessage(err)));
  }, [project.id]);

  const invite = async () => {
    setCreating(true);
    try {
      const token = await createInvite(project.id);
      setLink(`${location.origin}/invite/${token}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // first click arms the button, second click removes
  const onRemoveClick = async (m: Member) => {
    if (confirming !== m.id) {
      setConfirming(m.id);
      return;
    }
    setConfirming(null);

    const self = m.id === user.id;
    try {
      await removeMember(project.id, m.id);
      if (self) {
        navigate("/");
        return;
      }
      setMembers((ms) => ms?.filter((x) => x.id !== m.id) ?? null);
      toast.success(`Removed ${m.login}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      {isOwner && (
        <section className="grid gap-3 border-b p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Invite link</h3>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              Expires in 7 days
            </span>
          </div>

          {link ? (
            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="secondary"
                onClick={copy}
                className="shrink-0 cursor-pointer"
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={invite}
              disabled={creating}
              className="w-full cursor-pointer"
            >
              <Link2 />
              Create invite link
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Anyone with the link can join as an editor.
          </p>
        </section>
      )}

      <section className="grid gap-2 p-5">
        <h3 className="text-sm font-medium">
          Members
          {members && (
            <span className="font-normal text-muted-foreground">
              {" "}
              ({members.length})
            </span>
          )}
        </h3>

        <ul className="-mx-2 grid max-h-72 overflow-auto">
          {members === null ? (
            <>
              <MemberSkeleton />
              <MemberSkeleton />
            </>
          ) : (
            members.map((m) => {
              const self = m.id === user.id;
              const canRemove = m.role !== "owner" && (isOwner || self);
              const armed = confirming === m.id;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={m.avatarUrl} alt={m.name} />
                    <AvatarFallback>{m.login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {self && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{m.login}
                    </p>
                  </div>

                  {canRemove && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRemoveClick(m)}
                      onBlur={() => setConfirming(null)}
                      className="cursor-pointer"
                    >
                      {armed ? "Confirm" : self ? "Leave" : "Remove"}
                    </Button>
                  )}

                  <span className="w-12 text-right text-xs text-muted-foreground capitalize">
                    {m.role}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </>
  );
}

function MemberSkeleton() {
  return (
    <li className="flex items-center gap-3 px-2 py-2">
      <div className="size-8 animate-pulse rounded-full bg-muted" />
      <div className="grid flex-1 gap-1.5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
      </div>
    </li>
  );
}
