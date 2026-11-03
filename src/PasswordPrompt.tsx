import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Extras";
type Request = {
  title: string;
  run: (password: string) => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};
export function requestPassword<T>(
  title: string,
  run: (password: string) => Promise<T>,
  purpose?: string,
): Promise<T> {
  return new Promise((resolve, reject) =>
    window.dispatchEvent(
      new CustomEvent("zct_slms:password", {
        detail: { title, run, resolve, reject, purpose },
      }),
    ),
  );
}
export { AuthorizationPromptHost as PasswordPromptHost } from "./AuthorizationPrompt";
export function passwordField(
  path: string,
  params: Record<string, any>,
  method: string,
) {
  if (method !== "POST") return "";
  if (
    [
      "admin/identity/settings",
      "admin/platform-config",
      "admin/factors/settings",
      "admin/moderation",
      "admin/support/users",
      "admin/ticket-mail",
      "admin/mail-templates",
      "admin/account",
      "auth/password",
    ].includes(path)
  )
    return "current_password";
  if (
    [
      "auth/factors",
      "vouchers/create",
      "vouchers/reveal",
      "vouchers/delete",
      "app/secret/view",
      "app/secret/regenerate",
      "app/delete",
      "tickets/reset-password",
      "tickets/remove-passkey",
      "tickets/reset-security",
      "tickets/notifications/code",
      "tickets/notifications/verify",
      "admin/review/action",
      "app/heartbeat",
      "accounts/manage",
      "tickets/approve-closure",
    ].includes(path)
  )
    return "password";
  if (path === "tickets/create" && params.category === "PASSKEY")
    return "password";
  if (path.startsWith("auth/connect/") && params.action === "bind")
    return "password";
  if (path === "auth/factors/verify" && params.method === "password")
    return "password";
  return "";
}
