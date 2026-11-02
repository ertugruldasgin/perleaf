import type { ReactNode } from "react";
import { Link } from "react-router";
import { Slash } from "lucide-react";
import type { User } from "@/api";
import { APP_NAME } from "@/lib/config";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Logo } from "./Logo";

type Props = {
  user: User;
  children?: ReactNode;
  actions?: ReactNode;
};

export function AppHeader({ user, children, actions }: Props) {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Link
        to="/"
        className="flex gap-1 items-center justify-center font-semibold"
      >
        <Logo />
        <span className="font-brand text-lg font-semibold tracking-[-0.02em]">
          {APP_NAME}
        </span>
      </Link>

      {children && (
        <>
          <Slash className="size-4 -rotate-20 text-muted-foreground/50" />
          <div className="flex min-w-0 items-center gap-3">{children}</div>
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        {actions}
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
