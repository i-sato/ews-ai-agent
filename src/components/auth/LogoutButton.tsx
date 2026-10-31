import { logout } from "@/lib/auth/actions";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        Keluar
      </button>
    </form>
  );
}
