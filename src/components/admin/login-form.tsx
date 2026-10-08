"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/admin-actions";

const INITIAL_STATE: LoginState = { error: null, email: "" };

type LoginFormProps = {
  configured: boolean;
};

export const LoginForm = ({ configured }: LoginFormProps) => {
  const [state, formAction, isPending] = useActionState(login, INITIAL_STATE);

  return (
    <form action={formAction} className="panel rise3d mx-auto flex w-full max-w-md flex-col gap-5">
      <p className="tag">Доступ адміністратора</p>
      {!configured && (
        <p className="error">Задайте ADMIN_EMAIL, ADMIN_PASSWORD і SESSION_SECRET у .env.local і перезапустіть сервер.</p>
      )}
      <label className="flex flex-col gap-2 text-sm text-muted">
        Email
        <input
          key={state.email}
          name="email"
          type="email"
          required
          defaultValue={state.email}
          autoComplete="username"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-muted">
        Пароль
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn" disabled={isPending || !configured}>
        {isPending ? "Перевіряю…" : "Увійти"}
      </button>
    </form>
  );
};
