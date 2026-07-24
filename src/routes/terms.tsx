import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — Finance Flow Pocket" },
      { name: "description", content: "Términos y condiciones de uso del servicio Finance Flow Pocket." },
      { property: "og:title", content: "Términos y Condiciones — Finance Flow Pocket" },
      { property: "og:description", content: "Términos y condiciones de uso del servicio Finance Flow Pocket." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm md:prose-base">
        <p className="text-sm text-muted-foreground">
          <Link to="/about" className="underline">← Volver al inicio</Link>
        </p>
        <h1>Términos y Condiciones</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 23 de julio de 2026</p>

        <h2>1. Partes y aceptación</h2>
        <p>
          Estos Términos y Condiciones (&quot;Términos&quot;) regulan el uso del servicio
          Finance Flow Pocket (&quot;el Servicio&quot;), ofrecido por{" "}
          <strong>Angel Eduardo Puc Barrera</strong> (&quot;nosotros&quot;). Al crear una cuenta o
          usar el Servicio, aceptas estos Términos y contratas directamente con nosotros. Si no
          estás de acuerdo, no uses el Servicio.
        </p>

        <h2>2. Descripción del Servicio</h2>
        <p>
          Finance Flow Pocket es una herramienta de inteligencia financiera personal que permite
          distribuir ingresos en bolsillos, gestionar deudas y flujos, simular rendimientos y —en
          Android— registrar movimientos a partir de notificaciones bancarias que el usuario
          autoriza.
        </p>

        <h2>3. Cuenta y credenciales</h2>
        <p>
          Debes tener edad legal para contratar. Eres responsable de mantener la confidencialidad
          de tus credenciales y de toda actividad realizada bajo tu cuenta. Debes proporcionar
          información veraz y mantenerla actualizada.
        </p>

        <h2>4. Uso aceptable</h2>
        <p>No debes usar el Servicio para:</p>
        <ul>
          <li>Actividades ilegales, fraudulentas o que infrinjan derechos de terceros.</li>
          <li>Enviar spam, malware o contenido malicioso.</li>
          <li>Interferir con la seguridad, sondear, escanear o hacer scraping del Servicio.</li>
          <li>Descompilar, hacer ingeniería inversa o eludir restricciones técnicas.</li>
          <li>Revender, redistribuir o sublicenciar el Servicio.</li>
        </ul>

        <h2>5. Propiedad intelectual</h2>
        <p>
          Conservamos todos los derechos sobre el Servicio, incluyendo software, documentación,
          marcas y diseño. Te otorgamos una licencia limitada, no exclusiva, intransferible y
          revocable para usar el Servicio conforme a tu plan contratado. Tú conservas la
          titularidad del contenido que ingresas; nos otorgas una licencia limitada para alojarlo
          y procesarlo con el único fin de prestarte el Servicio.
        </p>

        <h2>6. Pagos, suscripciones e impuestos</h2>
        <p>
          Nuestro proceso de compra es operado por nuestro revendedor en línea{" "}
          <strong>Paddle.com</strong>. Paddle es el <em>Merchant of Record</em> de todas nuestras
          órdenes; Paddle atiende las consultas de servicio al cliente relacionadas con la compra
          y gestiona los reembolsos. Los términos de pago, facturación, impuestos, renovación,
          cancelación y devoluciones se rigen por los{" "}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            Términos de Comprador de Paddle
          </a>.
          Las suscripciones se renuevan automáticamente al final de cada periodo salvo que las
          canceles antes.
        </p>

        <h2>7. Política de reembolsos</h2>
        <p>
          Consulta nuestra <Link to="/refund" className="underline">Política de reembolsos</Link>.
        </p>

        <h2>8. Nivel de servicio y garantías</h2>
        <p>
          El Servicio se presta &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No
          garantizamos operación ininterrumpida ni libre de errores. En la máxima medida permitida
          por la ley, rechazamos garantías implícitas de comerciabilidad, idoneidad para un
          propósito particular y no infracción. El Servicio no constituye asesoría financiera,
          fiscal ni de inversión.
        </p>

        <h2>9. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley, nuestra responsabilidad total agregada por
          cualquier reclamación relacionada con el Servicio no excederá el monto pagado por ti
          durante los 12 meses anteriores al hecho que dio origen a la reclamación. No seremos
          responsables por daños indirectos, incidentales, especiales, consecuentes o punitivos
          (incluida pérdida de lucro, datos o buena voluntad). Nada en estos Términos limita
          responsabilidad por fraude, dolo, muerte o lesiones personales cuando la ley lo prohíba.
        </p>

        <h2>10. Indemnización</h2>
        <p>
          Aceptas indemnizarnos y liberarnos de reclamaciones de terceros derivadas de tu
          contenido, tu uso ilícito del Servicio o tu incumplimiento de estos Términos.
        </p>

        <h2>11. Suspensión y terminación</h2>
        <p>
          Podemos suspender o terminar tu acceso por incumplimiento material, falta de pago,
          riesgo de seguridad o fraude, o violaciones repetidas. Al terminar, dispondrás de un
          periodo razonable para exportar tu información antes de su eliminación.
        </p>

        <h2>12. Cambios al Servicio y a los Términos</h2>
        <p>
          Podemos modificar el Servicio y estos Términos. Notificaremos cambios materiales con
          antelación razonable. El uso continuado tras la fecha de vigencia constituye aceptación.
        </p>

        <h2>13. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por las leyes de México. Cualquier disputa se someterá a los
          tribunales competentes del domicilio del prestador, salvo derechos irrenunciables del
          consumidor.
        </p>

        <h2>14. Cesión y fuerza mayor</h2>
        <p>
          No puedes ceder estos Términos sin nuestro consentimiento. Podemos cederlos en fusiones
          o adquisiciones. Ninguna parte será responsable por incumplimientos causados por eventos
          fuera de su control razonable.
        </p>

        <h2>15. Contacto</h2>
        <p>
          <strong>Angel Eduardo Puc Barrera</strong> —{" "}
          <a href="mailto:soporte@financeflow-pocket.lovable.app">soporte@financeflow-pocket.lovable.app</a>
        </p>
      </div>
    </div>
  );
}
