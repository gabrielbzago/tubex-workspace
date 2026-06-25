"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthListener() {

  useEffect(() => {

    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        if (!session?.user) return;

        const user = session.user;

        await supabase
          .from("users")
          .upsert({

            email: user.email,

            name: user.user_metadata.full_name,

            avatar: user.user_metadata.avatar_url,

          });

      }
    );

    return () => listener.subscription.unsubscribe();

  }, []);

  return null;

}