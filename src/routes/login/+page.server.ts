import { fail, redirect } from "@sveltejs/kit";
import { login, sessionCookie } from "$lib/server/accounts";
import type { Actions, PageServerLoad } from "./$types";

/** `next` is only followed when it is a local absolute path. */
const safeNext = (next: string) =>
  /^\/(?![/\\])/.test(next) ? next : "/games";

export const load: PageServerLoad = ({ url }) => ({
  next: url.searchParams.get("next") ?? "",
});

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const next = String(form.get("next") ?? url.searchParams.get("next") ?? "");
    const result = await login(email, password);
    if ("error" in result)
      return fail(result.error === "login_limited" ? 429 : 400, {
        email,
        next,
        errors: { form: result.error },
      });
    cookies.set(sessionCookie.name, result.token, sessionCookie.options());
    redirect(303, safeNext(next));
  },
};
