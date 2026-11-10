import Link from "next/link";

export default function NotFound() {
  return (
    <section className="av-hero fade-in flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <h1 className="flicker text-[clamp(72px,18vw,168px)] leading-none">404</h1>
      <div className="sub mt-0">
        ESTA PANTALLA NO EXISTE EN EL VAULT <span className="blink">_</span>
      </div>
      <p className="m-0 max-w-[46ch] text-ink-dim">
        Revisa la dirección o vuelve a la biblioteca para elegir otro juego.
      </p>
      <Link href="/" className="btn lg mt-2">
        VOLVER AL VAULT
      </Link>
    </section>
  );
}
