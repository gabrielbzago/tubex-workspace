"use client";

import { useState } from "react";

import { supabase } from "@/lib/supabase";

import {
  Copy,
  Link2,
  Sparkles,
} from "lucide-react";

export default function AffiliateGenerator({
  userData,
  refreshUser,
}: any) {

  const [loading, setLoading] =
    useState(false);

  async function generateAffiliateCode() {

    if (!userData?.email) return;

    try {

      setLoading(true);

      // BASE NOME
      const baseName =
        (
          userData?.name
          || userData?.email
        )
          .replace(/\s+/g, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase();

      let unique = false;

      let finalCode = "";

      while (!unique) {

        const random =
          Math.floor(
            1000 + Math.random() * 9000
          );

        finalCode =
          `${baseName}${random}20`;

        // CHECA DUPLICAÇÃO
        const {
          data: existing,
        } = await supabase
          .from("users")
          .select("id")
          .eq(
            "affiliate_code",
            finalCode
          )
          .maybeSingle();

        if (!existing) {

          unique = true;

        }

      }

      console.log(
        "🔥 Código final:",
        finalCode
      );

      // UPDATE
      const { error } =
        await supabase
          .from("users")
          .update({

            affiliate_code:
              finalCode,

          })
          .eq(
            "email",
            String(userData.email)
              .trim()
              .toLowerCase()
          );

      if (error) {

        console.error(error);

        setLoading(false);

        return;

      }

      console.log(
        "✅ Código salvo!"
      );

      await refreshUser();

      setLoading(false);

    } catch (err) {

      console.error(err);

      setLoading(false);

    }

  }

  // LINK AFILIADO
  const affiliateLink =
    userData?.affiliate_code

      ? `https://tubex.app.br/?ref=${userData.affiliate_code}`

      : "";

  return (

    <div className="
      bg-card
      border
      border-border
      rounded-3xl
      p-8
      mt-6
    ">

      {/* HEADER */}
      <div className="
        flex
        items-center
        gap-3
        mb-6
      ">

        <div className="
          w-12
          h-12
          rounded-2xl
          bg-primary/10
          flex
          items-center
          justify-center
        ">

          <Sparkles size={22} />

        </div>

        <div>

          <h3 className="
            text-2xl
            font-black
          ">
            Sistema de Afiliados
          </h3>

          <p className="
            text-muted-foreground
            mt-1
          ">
            Gere seu código único
            e compartilhe seu link.
          </p>

        </div>

      </div>

      {/* CODE */}
      <div className="
        bg-background
        border
        border-border
        rounded-3xl
        p-6
      ">

        <p className="
          text-sm
          uppercase
          text-muted-foreground
          mb-3
        ">
          Código Afiliado
        </p>

        <div className="
          flex
          items-center
          justify-between
          gap-4
          flex-wrap
        ">

          <h2 className="
            text-3xl
            font-black
            break-all
          ">

            {
              userData?.affiliate_code
              || "SEM CÓDIGO"
            }

          </h2>

          <button
            onClick={
              generateAffiliateCode
            }
            disabled={loading}
            className="
              bg-primary
              text-primary-foreground
              px-6
              py-4
              rounded-2xl
              font-bold
              hover:opacity-90
              transition-all
            "
          >

            {
              loading

              ? "Gerando..."

              : userData?.affiliate_code

                ? "Gerar Novo"

                : "Gerar Código"
            }

          </button>

        </div>

      </div>

      {/* LINK */}
      {

        userData?.affiliate_code && (

          <div className="
            bg-background
            border
            border-border
            rounded-3xl
            p-6
            mt-6
          ">

            <p className="
              text-sm
              uppercase
              text-muted-foreground
              mb-3
            ">
              Link Afiliado
            </p>

            <div className="
              flex
              items-center
              gap-4
              flex-wrap
            ">

              {/* LINK */}
              <div className="
                flex-1
                min-w-[300px]
                bg-card
                border
                border-border
                rounded-2xl
                px-5
                py-4
                text-sm
                break-all
              ">

                {affiliateLink}

              </div>

              {/* COPY */}
              <button
                onClick={() => {

                  navigator.clipboard.writeText(
                    affiliateLink
                  );

                }}
                className="
                  bg-primary
                  text-primary-foreground
                  px-5
                  py-4
                  rounded-2xl
                  font-bold
                  flex
                  items-center
                  gap-2
                "
              >

                <Copy size={18} />

                Copiar

              </button>

            </div>

          </div>

        )

      }

    </div>

  );

}