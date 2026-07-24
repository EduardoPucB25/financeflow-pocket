import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Política de Reembolsos — Finance Flow Pocket" },
      { name: "description", content: "Garantía de devolución de 30 días para suscripciones de Finance Flow Pocket." },
      { property: "og:title", content: "Política de Reembolsos — Finance Flow Pocket" },
      { property: "og:description", content: "Garantía de devolución de 30 días para suscripciones de Finance Flow Pocket." },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm md:prose-base">
        <p className="text-sm text-muted-foreground">
          <Link to="/about" className="underline">← Volver al inicio</Link>
        </p>
        <h1>Política de Reembolsos</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 23 de julio de 2026</p>

        <p>
          Finance Flow Pocket, operado por <strong>Angel Eduardo Puc Barrera</strong>, ofrece una
          <strong> garantía de devolución de 30 días</strong> para todas las suscripciones Pro
          (mensuales y anuales).
        </p>

        <h2>Cómo solicitar un reembolso</h2>
        <p>
          Si dentro de los 30 días posteriores a la fecha de tu compra no estás satisfecho, puedes
          solicitar el reembolso completo del importe pagado. Los pagos son procesados por nuestro
          Merchant of Record, <strong>Paddle</strong>. Para pedir un reembolso:
        </p>
        <ol>
          <li>
            Visita{" "}
            <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
            e ingresa el correo electrónico con el que realizaste la compra para gestionar tu
            orden y solicitar el reembolso, o
          </li>
          <li>
            Escríbenos a{" "}
            <a href="mailto:soporte@financeflow-pocket.lovable.app">soporte@financeflow-pocket.lovable.app</a>{" "}
            con tu ID de orden Paddle y tramitaremos la solicitud con Paddle en tu nombre.
          </li>
        </ol>

        <h2>Cancelación</h2>
        <p>
          Puedes cancelar tu suscripción en cualquier momento desde <em>Ajustes → Gestionar suscripción</em>
          dentro de la aplicación. Al cancelar, conservarás acceso Pro hasta el final del periodo
          de facturación ya pagado y no se te cobrará una nueva renovación.
        </p>

        <h2>Renovaciones automáticas</h2>
        <p>
          Las suscripciones se renuevan automáticamente al final de cada periodo. Los cargos por
          renovación no son elegibles para reembolso una vez transcurridos los 30 días de la
          compra original, salvo que la ley aplicable indique lo contrario.
        </p>

        <h2>Contacto</h2>
        <p>
          <strong>Angel Eduardo Puc Barrera</strong> —{" "}
          <a href="mailto:soporte@financeflow-pocket.lovable.app">soporte@financeflow-pocket.lovable.app</a>
        </p>
      </div>
    </div>
  );
}
