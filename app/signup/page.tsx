"use client";

import { useMemo, useState } from "react";
import { useRedirectIfAuthed } from "@/lib/useRouteGuard";


type ApiError = { ok: false; error: { code: string; message: string; details?: any } };

type SignupOk = {
    ok: true;
    data: {
        user: {
            employeeId: number;
            companyId: number;
            role: "EMPLOYEE" | "ADMIN" | "OWNER";
            name: string | null;
            companyName: string;
        };
    };
};

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [companyName, setCompanyName] = useState("");


    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const canSubmit = useMemo(() => {
        if (loading) return false;
        return (
            email.trim().length > 0 &&
            password.length >= 8 &&
            name.trim().length > 0 &&
            companyName.trim().length > 0
        );
    }, [loading, email, password, name, companyName]);


    async function postJson<T>(url: string, body: any): Promise<T> {
        const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return data as T;
    }

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);

        try {
            const data = await postJson<SignupOk | ApiError>("/api/auth/signup", {
                email,
                password,
                name,
                companyName,
            });


            if ((data as any).ok === false) {
                const d = data as ApiError;
                setErrorMsg(d.error?.message ?? "Signup failed");
                return;
            }

            // success: cookie should be set server-side
            window.location.href = "/admin";
        } catch (err: any) {
            setErrorMsg(err?.message ?? "Unexpected error");
        } finally {
            setLoading(false);
        }
    }
    const { loading: guardLoading } = useRedirectIfAuthed({ redirectTo: "/admin" });
    if (guardLoading) return null;

    return (
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
            <h1>Sign up</h1>
            <p style={{ marginTop: 6, color: "#666" }}>
                Creates the first owner account for a new company (V1).
            </p>

            <form onSubmit={handleSignup} style={{ display: "grid", gap: 12, marginTop: 20 }}>

                <label style={{ display: "grid", gap: 6 }}>
                    <span>Your name</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="Your name"
                        style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                    />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                    <span>Company name</span>
                    <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        autoComplete="organization"
                        placeholder="Your company"
                        style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                    />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                    <span>Email</span>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="you@company.com"
                        style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                    />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                    <span>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                    />
                </label>

                {errorMsg ? <p style={{ color: "crimson" }}>{errorMsg}</p> : null}

                <button
                    disabled={!canSubmit}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #333" }}
                >
                    {loading ? "Creating account..." : "Create account"}
                </button>

                <p style={{ marginTop: 6, fontSize: 14, color: "#666" }}>
                    Already have an account? <a href="/login">Login</a>
                </p>
            </form>
        </main>
    );
}
