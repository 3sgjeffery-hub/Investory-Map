"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDemo = async () => {
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: "demo@investorymap.com",
      password: "demo",
      redirect: false,
    });

    if (result?.error) {
      setError("Demo not available");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <button
        onClick={handleDemo}
        disabled={loading}
        style={{
          padding: "13px 36px",
          background: "#ffffff",
          border: "2px solid #4f46e5",
          borderRadius: 8,
          color: "#4f46e5",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        {loading ? "Loading demo..." : "Try Demo"}
      </button>
      {error && (
        <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}
