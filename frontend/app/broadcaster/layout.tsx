import BroadcasterShellClient from "./BroadcasterShellClient";

export default function BroadcasterLayout({ children }: { children: React.ReactNode }) {
  return <BroadcasterShellClient>{children}</BroadcasterShellClient>;
}