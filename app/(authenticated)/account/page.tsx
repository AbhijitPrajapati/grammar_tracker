import { DeleteAccountButton } from "@/src/presentation/components/account/DeleteAccountButton";
import { PasswordChangeForm } from "@/src/presentation/components/account/PasswordChangeForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/presentation/components/ui/card";

export default function AccountPage() {
  return (
    <main className="px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-primary">Account</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Manage your account
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Confirm your current password before choosing a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Permanently delete your account, speeches, and analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
