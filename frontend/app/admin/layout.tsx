import type { Metadata } from "next";
import AdminShellClient from "./AdminShellClient";

export const metadata: Metadata = {
  title: "Admin Control | MomentBid",
  description: "Platform Administration System",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShellClient>{children}</AdminShellClient>;
}