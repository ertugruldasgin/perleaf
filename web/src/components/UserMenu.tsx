import { LogOut } from "lucide-react";
import { logout, type User } from "../api";

export function UserMenu({ user }: { user: User }) {
  const signOut = async () => {
    await logout();
    location.href = "/";
  };

  return (
    <div className="flex items-center gap-2">
      <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
      <span className="text-neutral-700">{user.login}</span>
      <button
        onClick={signOut}
        title="Sign out"
        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
