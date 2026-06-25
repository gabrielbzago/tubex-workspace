"use client";

import { LogOut } from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function UserMenu() {

async function logout() {

  try {

    // ============================
    // LIMPA SESSION
    // ============================

    sessionStorage.clear();

    // ============================
    // LIMPA CACHE LOCAL
    // ============================

    localStorage.removeItem("tubex-seo-result");
    localStorage.removeItem("tubex-seo-keyword");

    localStorage.removeItem("tubex-viral-result");
    localStorage.removeItem("tubex-viral-keyword");

    localStorage.removeItem("tubex-thumbnail-result");
    localStorage.removeItem("tubex-thumbnail-keyword");

    localStorage.removeItem("affiliate_ref");

    // caso use outras chaves começando com tubex
    Object.keys(localStorage).forEach((key) => {

      if (key.startsWith("tubex")) {

        localStorage.removeItem(key);

      }

    });

    // ============================
    // LIMPA CACHE GLOBAL
    // ============================

    if ("caches" in window) {

      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => caches.delete(key))
      );

    }

    // ============================
    // LOGOUT SUPABASE
    // ============================

    await supabase.auth.signOut();

    // ============================
    // REDIRECIONA
    // ============================

    window.location.replace("/");

  } catch (err) {

    console.error(err);

  }

}

  return (

    <button
      onClick={logout}
      className="
        h-12
        px-5
        rounded-2xl
        bg-red-500
        hover:bg-red-400
        text-white
        font-semibold
        transition-all
        duration-200
        hover:scale-105
        flex
        items-center
        gap-2
      "
    >

      <LogOut size={18} />

      Sair

    </button>

  );

}