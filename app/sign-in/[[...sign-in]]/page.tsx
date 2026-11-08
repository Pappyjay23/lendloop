import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Good tools are better when they move."
      copy="Sign in to list what you have, ask for what you need, and keep every loan on the record."
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/browse"
      />
    </AuthShell>
  );
}
