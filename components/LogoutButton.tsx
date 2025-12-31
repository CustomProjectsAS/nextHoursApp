"use client";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.href = "/login";
        }
      }}
    >
      Log out
    </Button>
  );
}

