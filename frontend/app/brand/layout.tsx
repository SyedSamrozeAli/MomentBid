import type { ReactNode } from "react";
import BrandShellClient from "./BrandShellClient";

export default function BrandLayout({ children }: { children: ReactNode }) {
  return <BrandShellClient>{children}</BrandShellClient>;
}
