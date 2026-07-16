import { EmployerShell } from "./_components/EmployerShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <EmployerShell>{children}</EmployerShell>;
}
