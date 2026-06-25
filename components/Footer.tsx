import Link from "next/link";

export default function Footer() {

  return (

    <footer
      className="
      border-t
      border-zinc-900
      py-16
      mt-20
      "
    >

      <div
        className="
        max-w-7xl
        mx-auto
        px-6
        flex
        flex-wrap
        gap-8
        justify-between
        "
      >

        <div>

          <h3
            className="
            text-3xl
            font-bold
            text-yellow-400
            "
          >
            TubeX
          </h3>

          <p className="text-zinc-500 mt-4">

            Plataforma completa para criadores.

          </p>

        </div>

        <div className="flex gap-6 text-zinc-400">

          <Link href="/privacy">

            Privacidade

          </Link>

          <Link href="/termos">

            Termos

          </Link>

          <Link href="/updates">

            Updates

          </Link>

        </div>

      </div>

    </footer>

  );

}