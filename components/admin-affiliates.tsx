"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase }
from "@/lib/supabase";

import {
  DollarSign,
  Users,
  BadgeCheck,
} from "lucide-react";

export default function AdminAffiliates() {

  const [users, setUsers] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    fetchAffiliates();

  }, []);

  async function fetchAffiliates() {

    setLoading(true);

   const {
  data,
  error,
} = await supabase
  .from("users")
  .select(`
    id,
    name,
    email,
    affiliate_code,
    pix_key,
    affiliate_balance,
    affiliate_paid
  `)
  .not(
    "affiliate_code",
    "is",
    null
  );

    if (error) {

      console.error(error);

      return;

    }

    setUsers(data || []);

    setLoading(false);

  }

  async function markAsPaid(
    affiliate: any
  ) {

    const confirmPay =
      confirm(
        `Confirmar pagamento de R$ ${affiliate.affiliate_balance}?`
      );

    if (!confirmPay)
      return;

    // HISTÓRICO
    await supabase
      .from(
        "affiliate_payouts"
      )
      .insert({

        affiliate_code:
          affiliate.affiliate_code,

        affiliate_email:
          affiliate.email,

        amount:
          affiliate.affiliate_balance,

        pix_key:
          affiliate.pix_key,

        status:
          "paid",

      });

    // UPDATE USER
    await supabase
      .from("users")
      .update({

        affiliate_paid:
          Number(
            (
              (
                affiliate
                  .affiliate_paid || 0
              ) +
              affiliate
                .affiliate_balance
            ).toFixed(2)
          ),

        affiliate_balance: 0,

        last_payout:
          new Date(),

      })
      .eq(
        "id",
        affiliate.id
      );

    alert(
      "Pagamento registrado!"
    );

    fetchAffiliates();

  }
const totalPending =
  users.reduce(
    (acc, user) =>
      acc +
      Number(
        user.affiliate_balance || 0
      ),
    0
  );

const totalPaid =
  users.reduce(
    (acc, user) =>
      acc +
      Number(
        user.affiliate_paid || 0
      ),
    0
  );

  return (

    <div className="
      w-full
      space-y-8
    ">

      {/* STATS */}

      <div className="
        grid
        grid-cols-1
        md:grid-cols-3
        gap-6
      ">

        {/* AFILIADOS */}

        <div className="
          bg-card
          border
          border-border
          rounded-3xl
          p-7
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <p className="
              text-muted-foreground
            ">
              Afiliados
            </p>

            <Users
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
            {users.length}
          </h2>

        </div>

        {/* PENDENTE */}

        <div className="
          bg-card
          border
          border-border
          rounded-3xl
          p-7
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <p className="
              text-muted-foreground
            ">
              Pendente
            </p>

            <DollarSign
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
            R$ {
              totalPending.toFixed(
                2
              )
            }
          </h2>

        </div>

        {/* PAGOS */}

        <div className="
          bg-card
          border
          border-border
          rounded-3xl
          p-7
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <p className="
              text-muted-foreground
            ">
              Total Pago
            </p>

            <BadgeCheck
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
            R$ {
  totalPaid.toFixed(2)
}
                    
            
          </h2>

        </div>

      </div>

      {/* TABELA */}

      <div className="
        bg-card
        border
        border-border
        rounded-[32px]
        p-8
        overflow-x-auto
      ">

        <h2 className="
          text-3xl
          font-black
          mb-8
        ">
          Afiliados
        </h2>

        <table className="
          w-full
          min-w-[1100px]
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
                Nome
              </th>

              <th className="
                text-left
                py-4
              ">
                Email
              </th>

              <th className="
                text-left
                py-4
              ">
                Código
              </th>

              <th className="
                text-left
                py-4
              ">
                PIX
              </th>

              <th className="
                text-left
                py-4
              ">
                Pendente
              </th>

              <th className="
                text-left
                py-4
              ">
                Pago
              </th>

              <th className="
                text-left
                py-4
              ">
                Ação
              </th>

            </tr>

          </thead>

          <tbody>

            {
              users.map(
                (user) => (

                  <tr
                    key={user.id}
                    className="
                      border-b
                      border-border
                    "
                  >

                    <td className="
                      py-5
                    ">
                      {user.name}
                    </td>

                    <td className="
                      py-5
                    ">
                      {user.email}
                    </td>

                    <td className="
                      py-5
                    ">
                      {
                        user
                          .affiliate_code
                      }
                    </td>

                    <td className="
                      py-5
                    ">
                      {
                        user
                          .pix_key || "-"
                      }
                    </td>

                    <td className="
                      py-5
                      text-yellow-400
                      font-bold
                    ">
                      R$ {
                        Number(
                          user
                            .affiliate_balance || 0
                        ).toFixed(2)
                      }
                    </td>

                    <td className="
                      py-5
                      text-green-500
                      font-bold
                    ">
                      R$ {
                        Number(
                          user
                            .affiliate_paid || 0
                        ).toFixed(2)
                      }
                    </td>

                    <td className="
                      py-5
                    ">

                      <button
                        onClick={() =>
                          markAsPaid(
                            user
                          )
                        }
                        disabled={
                          Number(
                            user
                              .affiliate_balance || 0
                          ) <= 0
                        }
                        className="
                          bg-yellow-400
                          text-black
                          px-5
                          py-3
                          rounded-2xl
                          font-bold
                          disabled:opacity-50
                        "
                      >

                        Dar baixa

                      </button>

                    </td>

                  </tr>

                )
              )
            }

          </tbody>

        </table>

      </div>

    </div>

  );

}