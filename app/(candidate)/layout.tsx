import { CandidateShell } from "./_components/CandidateShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CandidateShell>{children}</CandidateShell>;
}
