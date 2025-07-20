"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl bg-white/80 dark:bg-black-glaze/80 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-black-glaze transition-colors cursor-pointer"
            aria-label="Toggle theme"
        >
            {theme === "dark" ? (
                <Sun className="w-5 h-5 text-eucalyptus" />
            ) : (
                <Moon className="w-5 h-5 text-eucalyptus" />
            )}
        </button>
    );
}