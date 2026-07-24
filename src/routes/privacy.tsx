import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidad — Finance Flow Pocket" },
      { name: "description", content: "Cómo Finance Flow Pocket recopila, usa y protege tus datos personales." },
      { property: "og:title", content: "Aviso de Privacidad — Finance Flow Pocket" },
      { property: "og:description", content: "Cómo Finance Flow Pocket recopila, usa y protege tus datos personales." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm md:prose-base">
        <p className="text-sm text-muted-foreground">
          <Link to="/about" className="underline">← Volver al inicio</Link>
        </p>
        <h1>Aviso de Privacidad</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 23 de julio de 2026</p>

        <p>
          Este Aviso de Privacidad describe cómo <strong>Angel Eduardo Puc Barrera</strong>
          (&quot;nosotros&quot;), operador del servicio Finance Flow Pocket (&quot;el Servicio&quot;),
          recopila, usa y protege tu información personal. Actuamos como responsable del
          tratamiento (data controller) de los datos que recopilamos directamente a través del Servicio.
        </p>

        <h2>1. Datos que recopilamos</h2>
        <ul>
          <li><strong>Cuenta:</strong> correo electrónico y credenciales de inicio de sesión.</li>
          <li><strong>Datos financieros que tú ingresas:</strong> bolsillos, deudas, flujos, transacciones y notas.</li>
          <li><strong>Datos de notificaciones bancarias (solo Android, opcional):</strong> monto, comercio y tipo de movimiento, procesados en tu dispositivo y sincronizados a tu cuenta solo si autorizas la función.</li>
          <li><strong>Uso y telemetría:</strong> logs de errores, direcciones IP y datos de dispositivo para seguridad y mejora del Servicio.</li>
          <li><strong>Soporte:</strong> mensajes que nos envíes.</li>
        </ul>
        <p>
          No procesamos datos de tarjeta ni información de pago: esos datos son recopilados y
          tratados directamente por Paddle como Merchant of Record (ver sección 4).
        </p>

        <h2>2. Finalidades y bases legales</h2>
        <ul>
          <li>Crear y mantener tu cuenta, y prestarte el Servicio (ejecución del contrato).</li>
          <li>Prevención de fraude, abuso y seguridad (interés legítimo).</li>
          <li>Mejora del producto y análisis agregado (interés legítimo).</li>
          <li>Atención al cliente (ejecución del contrato).</li>
          <li>Cumplir obligaciones legales aplicables (obligación legal).</li>
        </ul>

        <h2>3. Cookies</h2>
        <p>
          Usamos cookies estrictamente necesarias para autenticación y funcionamiento del Servicio.
          No usamos cookies de marketing de terceros. Puedes controlar cookies desde tu navegador.
        </p>

        <h2>4. Con quién compartimos tus datos</h2>
        <ul>
          <li><strong>Proveedores de infraestructura</strong> (hosting, base de datos, monitoreo) que actúan como encargados del tratamiento.</li>
          <li><strong>Paddle.com Market Limited</strong>, nuestro Merchant of Record, para procesamiento de pagos, facturación, cumplimiento fiscal y gestión de suscripciones.</li>
          <li><strong>Asesores profesionales</strong> (legales, contables) cuando sea necesario.</li>
          <li><strong>Autoridades competentes</strong> cuando la ley lo requiera.</li>
        </ul>

        <h2>5. Transferencias internacionales</h2>
        <p>
          Algunos de nuestros proveedores procesan datos fuera de tu país de residencia. Cuando esto
          ocurre, usamos salvaguardas apropiadas (cláusulas contractuales tipo o decisiones de
          adecuación) para proteger tu información.
        </p>

        <h2>6. Retención</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo razonablemente
          necesario para las finalidades descritas. Al eliminar tu cuenta, borramos o anonimizamos
          tus datos, salvo aquellos que debamos conservar por obligación legal.
        </p>

        <h2>7. Tus derechos</h2>
        <p>
          Según tu jurisdicción, puedes tener derecho de acceso, rectificación, cancelación,
          oposición, portabilidad, limitación del tratamiento y retiro del consentimiento. Para
          ejercer estos derechos escríbenos a{" "}
          <a href="mailto:soporte@financeflow-pocket.lovable.app">soporte@financeflow-pocket.lovable.app</a>.
          Responderemos en el plazo aplicable por ley (típicamente 1 mes bajo GDPR).
        </p>

        <h2>8. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito, controles de
          acceso, aislamiento por usuario mediante RLS) para proteger tus datos. Ningún sistema es
          100% infalible.
        </p>

        <h2>9. Cambios a este Aviso</h2>
        <p>
          Podemos actualizar este Aviso. La versión vigente estará siempre disponible en esta URL,
          con su fecha de última actualización.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Responsable: <strong>Angel Eduardo Puc Barrera</strong>.<br />
          Correo: <a href="mailto:soporte@financeflow-pocket.lovable.app">soporte@financeflow-pocket.lovable.app</a>
        </p>
      </div>
    </div>
  );
}
