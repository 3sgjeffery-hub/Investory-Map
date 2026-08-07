"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface DemoButtonProps {
  variant?: "admin" | "teacher";
}

export default function DemoButton({ variant = "admin" }: DemoButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isTeacher = variant === "teacher";

  const handleDemo = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error || "Failed to set up demo");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: isTeacher ? "teacher@demo.investorymap.com" : "demo@investorymap.com",
        password: "demo",
        redirect: false,
      });

      if (result?.error) {
        setError("Login failed after setup");
        setLoading(false);
        return;
      }

      router.push(isTeacher ? "/report" : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <button
        onClick={handleDemo}
        disabled={loading}
        style={{
          padding: isTeacher ? "10px 28px" : "13px 36px",
          background: "#ffffff",
          border: `2px solid ${isTeacher ? "#f59e0b" : "#4f46e5"}`,
          borderRadius: 8,
          color: isTeacher ? "#b45309" : "#4f46e5",
          fontSize: isTeacher ? 13 : 15,
          fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        {loading
          ? "Loading demo..."
          : isTeacher
            ? "Try as Teacher"
            : "Try Demo"}
      </button>
      {error && (
        <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}
