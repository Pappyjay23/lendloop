import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Join LendLoop" };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Join the loop"
      title="Your shed is somebody's shortcut."
      copy="Create an account to lend quietly, borrow locally, and let the reminders take care of themselves."
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/browse"
      />
    </AuthShell>
  );
}
