import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "seed-test-user-2026-07-23";

export const Route = createFileRoute("/api/internal/seed-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        if (body.token !== TOKEN) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
        });
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ userId: data.user?.id });
      },
    },
  },
});
