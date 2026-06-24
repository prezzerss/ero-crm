"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type SignInButtonsProps = {
  nextPath: string;
};

export function SignInButtons({ nextPath }: SignInButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn() {
    setErrorMessage("");
    setIsLoading(true);

    const supabase = createBrowserSupabaseClient();
    const origin = window.location.origin;
    const redirectTo = new URL("/auth/callback", origin);
    redirectTo.searchParams.set("next", nextPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: redirectTo.toString(),
        scopes: "openid email profile User.Read",
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        className="crm-button crm-button-primary w-full justify-center"
        disabled={isLoading}
        onClick={signIn}
        type="button"
      >
        {isLoading ? "Opening Microsoft..." : "Sign in with Microsoft"}
      </button>

      {errorMessage && (
        <p className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
