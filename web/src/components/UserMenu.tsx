import { ExternalLink, LogOut } from "lucide-react";
import { logout, type User } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ user }: { user: User }) {
  const signOut = async () => {
    await logout();
    location.href = "/";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={user.name}
        className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring hover:cursor-pointer"
      >
        <Avatar className="size-7">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback>{user.login[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            @{user.login}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            window.open(
              `https://github.com/${user.login}`,
              "_blank",
              "noopener",
            )
          }
        >
          <ExternalLink />
          GitHub profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
