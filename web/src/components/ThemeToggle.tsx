import { Moon, Sun } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      onClick={toggleTheme}
      title={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "cursor-pointer",
      )}
    >
      <Icon />
    </button>
  );
}
