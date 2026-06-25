"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {

  const [dark, setDark] = useState(true);

  useEffect(() => {

    const savedTheme =
      localStorage.getItem("tubex-theme");

    if (savedTheme === "light") {

      document.documentElement.classList.remove("dark");

      setDark(false);

    } else {

      document.documentElement.classList.add("dark");

      setDark(true);

    }

  }, []);

  function toggleTheme() {

    const newDark = !dark;

    setDark(newDark);

    if (newDark) {

      document.documentElement.classList.add("dark");

      localStorage.setItem(
        "tubex-theme",
        "dark"
      );

    } else {

      document.documentElement.classList.remove("dark");

      localStorage.setItem(
        "tubex-theme",
        "light"
      );

    }

  }

  return (

    <button
      onClick={toggleTheme}
      className="
      w-12
      h-12
      rounded-2xl
      border
      border-zinc-800
      bg-zinc-900
      dark:bg-zinc-900
      flex
      items-center
      justify-center
      hover:scale-105
      transition
      "
    >

      {
        dark
        ? <Sun size={18}/>
        : <Moon size={18}/>
      }

    </button>

  );

}