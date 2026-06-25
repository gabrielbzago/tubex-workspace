"use client";

import {
  Copy,
  DollarSign,
  Users,
  MousePointerClick,
  TrendingUp,
  BadgeCheck,
  ExternalLink,
  Gift,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

export default function AffiliatePage({
  userData,
}: any) {

  const [referrals, setReferrals] =
    useState<any[]>([]);

  const [stats, setStats] =
    useState({
      clicks: 0,
      sales: 0,
      commission: 0,
      conversion: 0,
    });

const [userState, setUserData] =
  useState(userData);

  const affiliateLink =
    `https://tubex.app/?ref=${userData?.affiliate_code}`;

  async function copyLink() {

    await navigator.clipboard.writeText(
      affiliateLink
    );

    alert("Link copiado!");

  }

  useEffect(() => {

    if (
      !userData?.affiliate_code
    ) return;

    fetchReferrals();

  }, [userData]);

  async function fetchReferrals() {

    const {
      data,
      error,
    } = await supabase
      .from(
        "affiliate_referrals"
      )
      .select("*")
      .eq(
        "affiliate_code",
        userData.affiliate_code
      )
      .order(
        "created_at",
        { ascending: false }
      );

    if (error) {

      console.error(error);

      return;

    }


const {
  data: salesData,
  error: salesError,
} = await supabase
  .from("affiliate_sales")
  .select("*")
  .eq(
    "affiliate_code",
    userData.affiliate_code
  );

if (salesError) {

  console.error(
    salesError
  );

}

    setReferrals(
  salesData || []
);

 const sales =
  salesData?.length || 0;

const commission =
  salesData?.reduce(
    (acc, sale) =>
      acc +
      Number(
        sale.commission_amount || 0
      ),
    0
  ) || 0;

    const clicks =
      sales * 8;

    const conversion =
      clicks > 0
        ? (
            (sales / clicks) *
            100
          ).toFixed(1)
        : 0;

    setStats({
      clicks,
      sales,
      commission,
      conversion:
        Number(conversion),
    });

  }

async function savePixData() {

  const {
    error,
  } = await supabase
    .from("users")
    .update({

      cpf:
        userState?.cpf,

      pix_type:
        userState?.pix_type,

      pix_key:
        userState?.pix_key,

    })
    .eq(
      "id",
      userData.id
    );

  if (error) {

    console.error(error);

    alert(
      "Erro ao salvar"
    );

    return;

  }

  alert(
    "Dados PIX salvos!"
  );

}

  return (

    <div className="
      w-full
      space-y-8
      pb-10
    ">

      {/* HERO */}

      <div className="
        relative
        overflow-hidden
        rounded-[32px]
        border
        border-border
        bg-card
        p-8
        lg:p-10
      ">

        <div className="
          absolute
          inset-0
          bg-gradient-to-br
          from-yellow-400/10
          to-transparent
        " />

        <div className="
          relative
          z-10
        ">

          <div className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            lg:justify-between
            gap-8
          ">

            <div>

              <div className="
                flex
                items-center
                gap-4
              ">

                <div className="
                  w-16
                  h-16
                  rounded-3xl
                  bg-yellow-400
                  text-black
                  flex
                  items-center
                  justify-center
                ">

                  <Gift size={30} />

                </div>

                <div>

                  <h1 className="
                    text-4xl
                    font-black
                  ">
                    Programa Afiliados
                  </h1>

                  <p className="
                    text-muted-foreground
                    mt-1
                  ">
                    Convide pessoas e ganhe comissões recorrentes
                  </p>

                </div>

              </div>

            </div>

            <div className="
              flex
              flex-col
              gap-4
              w-full
              lg:w-[520px]
            ">

              <div className="
                bg-background
                border
                border-border
                rounded-2xl
                p-4
                text-sm
                break-all
              ">

                {affiliateLink}

              </div>

              <button
                onClick={copyLink}
                className="
                  h-14
                  rounded-2xl
                  bg-yellow-400
                  text-black
                  font-bold
                  hover:scale-[1.02]
                  transition-all
                "
              >

                Copiar Link

              </button>

            </div>

          </div>

        </div>

      </div>

      {/* STATS */}

      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-4
        gap-6
      ">

        {
          [
            {
              title: "Ganhos",
              value:
                `R$ ${stats.commission}`,
              icon: DollarSign,
            },

            {
              title: "Vendas",
              value:
                stats.sales,
              icon: Users,
            },

            {
              title: "Cliques",
              value:
                stats.clicks,
              icon:
                MousePointerClick,
            },

            {
              title: "Conversão",
              value:
                `${stats.conversion}%`,
              icon: TrendingUp,
            },
          ].map((item, index) => {

            const Icon =
              item.icon;

            return (

              <div
                key={index}
                className="
                  rounded-3xl
                  border
                  border-border
                  bg-card
                  p-7
                "
              >

                <div className="
                  flex
                  items-center
                  justify-between
                ">

                  <p className="
                    text-muted-foreground
                  ">
                    {item.title}
                  </p>

                  <Icon
                    className="
                      text-yellow-400
                    "
                  />

                </div>

                <h2 className="
                  text-5xl
                  font-black
                  mt-6
                ">

                  {item.value}

                </h2>

              </div>

            );

          })
        }

      </div>

{/* PIX SETTINGS */}

<div className="
  rounded-[32px]
  border
  border-border
  bg-card
  p-8
">

  <div className="
    mb-8
  ">

    <h2 className="
      text-3xl
      font-black
    ">
      Dados PIX
    </h2>

    <p className="
      text-muted-foreground
      mt-2
    ">
      Dados para recebimento das comissões
    </p>

  </div>

  <div className="
    grid
    grid-cols-1
    md:grid-cols-2
    gap-6
  ">

    {/* CPF */}

    <div>

      <label className="
        text-sm
        text-muted-foreground
        block
        mb-2
      ">
        CPF
      </label>

      <input
        type="text"
        value={
  userState?.cpf || ""
}
        onChange={(e) =>
          setUserData({
            ...userState,
            cpf:
              e.target.value,
          })
        }
        className="
          w-full
          h-14
          rounded-2xl
          bg-background
          border
          border-border
          px-4
        "
      />

    </div>

    {/* PIX TYPE */}

    <div>

      <label className="
        text-sm
        text-muted-foreground
        block
        mb-2
      ">
        Tipo PIX
      </label>

      <select
        value={
  userState?.pix_type ||
  "cpf"
}
        onChange={(e) =>
          setUserData({
            ...userState,
            pix_type:
              e.target.value,
          })
        }
        className="
          w-full
          h-14
          rounded-2xl
          bg-background
          border
          border-border
          px-4
        "
      >

        <option value="cpf">
          CPF
        </option>

        <option value="email">
          E-mail
        </option>

        <option value="phone">
          Telefone
        </option>

        <option value="random">
          Aleatória
        </option>

      </select>

    </div>

    {/* PIX KEY */}

    <div className="
      md:col-span-2
    ">

      <label className="
        text-sm
        text-muted-foreground
        block
        mb-2
      ">
        Chave PIX
      </label>

      <input
        type="text"
        value={
  userState?.pix_key || ""
}
        onChange={(e) =>
          setUserData({
            ...userState,
            pix_key:
              e.target.value,
          })
        }
        className="
          w-full
          h-14
          rounded-2xl
          bg-background
          border
          border-border
          px-4
        "
      />

    </div>

  </div>

  <button
    onClick={savePixData}
    className="
      mt-8
      h-14
      px-8
      rounded-2xl
      bg-yellow-400
      text-black
      font-bold
      hover:scale-[1.02]
      transition-all
    "
  >

    Salvar Dados

  </button>

</div>


      {/* REFERIDOS */}

      <div className="
        rounded-[32px]
        border
        border-border
        bg-card
        p-8
        overflow-hidden
      ">

        <div className="
          flex
          items-center
          justify-between
          mb-8
        ">

          <div>

            <h2 className="
              text-3xl
              font-black
            ">
              Referidos
            </h2>

            <p className="
              text-muted-foreground
              mt-2
            ">
              Pessoas que compraram usando seu link
            </p>

          </div>

        </div>

        <div className="
          overflow-x-auto
        ">

          <table className="
            w-full
            min-w-[700px]
          ">

            <thead>

              <tr className="
                border-b
                border-border
              ">

                <th className="
                  text-left
                  py-4
                ">
                  Usuário
                </th>

                <th className="
                  text-left
                  py-4
                ">
                  Plano
                </th>

                <th className="
                  text-left
                  py-4
                ">
                  Comissão
                </th>

                <th className="
                  text-left
                  py-4
                ">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {
                referrals.map(
                  (
                    item,
                    index
                  ) => (

                    <tr
                      key={index}
                      className="
                        border-b
                        border-border
                      "
                    >

                      <td className="
                        py-5
                      ">
      		      {
 		 item.referred_name ||
 		 item.customer_email ||
 		 item.referred_email
			}
                      </td>

                      <td className="
                        py-5
                        capitalize
                      ">
                        {item.plan}
                      </td>

                      <td className="
                        py-5
                        text-green-500
                        font-bold
                      ">
                        R$ {
 			 Number(
 			   item.commission_amount || 0
 			 ).toFixed(2)
			}
                      </td>

                      <td className="
                        py-5
                      ">

                        <span className="
                          px-4
                          py-2
                          rounded-full
                          bg-green-500/10
                          text-green-500
                          text-sm
                        ">

                          {
                            item.status
                          }

                        </span>

                      </td>

                    </tr>

                  )
                )
              }

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );

}