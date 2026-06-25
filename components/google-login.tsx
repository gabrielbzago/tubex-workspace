"use client";

import { supabase } from "@/lib/supabase";

export default function GoogleLogin() {

  async function loginGoogle() {

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000"
      }
    });

  }

  return (

    <button
      onClick={loginGoogle}
      className="
      bg-yellow-400
      hover:bg-yellow-300
      text-black
      font-semibold
      px-6
      py-3
      rounded-2xl
      transition-all
      duration-200
      hover:scale-105
      "
    >
      Entrar com Google
    </button>

  );

}