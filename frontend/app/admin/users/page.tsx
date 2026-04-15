"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Users, Building2, UserPlus, AlertTriangle } from "lucide-react";

import {
  AdminApiError,
  listBrands,
  listBroadcasters,
  registerBrand,
  registerBroadcaster,
  type BrandListItem,
  type BroadcasterListItem,
} from "@/lib/adminApi";

type RegistrationFormState = {
  orgName: string;
  username: string;
  email: string;
  password: string;
  logo: File | null;
};

const emptyRegistrationFormState: RegistrationFormState = {
  orgName: "",
  username: "",
  email: "",
  password: "",
  logo: null,
};

function toErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

function renderCount(value: number, isLoading: boolean): string {
  if (isLoading) {
    return "...";
  }

  return String(value);
}

export default function AdminUsersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [broadcasters, setBroadcasters] = useState<BroadcasterListItem[]>([]);

  const [brandForm, setBrandForm] = useState<RegistrationFormState>(emptyRegistrationFormState);
  const [brandError, setBrandError] = useState("");
  const [brandSuccess, setBrandSuccess] = useState("");
  const [isBrandSubmitting, setIsBrandSubmitting] = useState(false);

  const [broadcasterForm, setBroadcasterForm] = useState<RegistrationFormState>(emptyRegistrationFormState);
  const [broadcasterError, setBroadcasterError] = useState("");
  const [broadcasterSuccess, setBroadcasterSuccess] = useState("");
  const [isBroadcasterSubmitting, setIsBroadcasterSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      setIsLoading(true);
      setLoadError("");

      try {
        const [brandRecords, broadcasterRecords] = await Promise.all([listBrands(), listBroadcasters()]);

        if (!isMounted) {
          return;
        }

        setBrands(brandRecords);
        setBroadcasters(broadcasterRecords);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBrands([]);
        setBroadcasters([]);
        setLoadError(toErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const brandCount = useMemo(() => brands.length, [brands]);
  const broadcasterCount = useMemo(() => broadcasters.length, [broadcasters]);

  function updateBrandField<K extends keyof RegistrationFormState>(field: K, value: RegistrationFormState[K]): void {
    setBrandForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateBroadcasterField<K extends keyof RegistrationFormState>(field: K, value: RegistrationFormState[K]): void {
    setBroadcasterForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleBrandSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBrandError("");
    setBrandSuccess("");

    const brandName = brandForm.orgName.trim();
    const username = brandForm.username.trim();
    const email = brandForm.email.trim();
    const password = brandForm.password;

    if (!brandName || !username || !email || !password) {
      setBrandError("All fields are required.");
      return;
    }

    setIsBrandSubmitting(true);
    try {
      const response = await registerBrand({
        brand_name: brandName,
        username,
        email,
        password,
        logo: brandForm.logo,
      });

      setBrandSuccess(`Created: ${response.user.username}`);
      setBrandForm(emptyRegistrationFormState);

      const latestBrands = await listBrands();
      setBrands(latestBrands);
    } catch (error) {
      setBrandError(toErrorMessage(error));
    } finally {
      setIsBrandSubmitting(false);
    }
  }

  async function handleBroadcasterSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBroadcasterError("");
    setBroadcasterSuccess("");

    const broadcasterName = broadcasterForm.orgName.trim();
    const username = broadcasterForm.username.trim();
    const email = broadcasterForm.email.trim();
    const password = broadcasterForm.password;

    if (!broadcasterName || !username || !email || !password) {
      setBroadcasterError("All fields are required.");
      return;
    }

    setIsBroadcasterSubmitting(true);
    try {
      const response = await registerBroadcaster({
        broadcaster_name: broadcasterName,
        username,
        email,
        password,
        logo: broadcasterForm.logo,
      });

      setBroadcasterSuccess(`Created: ${response.user.username}`);
      setBroadcasterForm(emptyRegistrationFormState);

      const latestBroadcasters = await listBroadcasters();
      setBroadcasters(latestBroadcasters);
    } catch (error) {
      setBroadcasterError(toErrorMessage(error));
    } finally {
      setIsBroadcasterSubmitting(false);
    }
  }

  function handleBrandLogoChange(event: ChangeEvent<HTMLInputElement>): void {
    updateBrandField("logo", event.target.files?.[0] ?? null);
  }

  function handleBroadcasterLogoChange(event: ChangeEvent<HTMLInputElement>): void {
    updateBroadcasterField("logo", event.target.files?.[0] ?? null);
  }

  return (
    <div className="p-6 md:p-10 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">User Management</h2>
          <p className="mt-1 text-sm text-[#4E8098]">Admin user and organization controls mapped to implemented backend endpoints.</p>
        </div>
      </div>

      {loadError ? (
        <div className="border border-[#A31621]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
          {loadError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2">
            <Users className="w-3 h-3" />
            Registered Brands
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">{renderCount(brandCount, isLoading)}</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2">
            <Building2 className="w-3 h-3" />
            Registered Broadcasters
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">{renderCount(broadcasterCount, isLoading)}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="bg-white border border-[#CED3DC] overflow-hidden">
          <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8]">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Brand Directory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-widest text-[#4E8098] bg-white border-b border-[#CED3DC]">
                <tr>
                  <th className="px-5 py-4 font-semibold">ID</th>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Wallet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {isLoading ? (
                  <tr>
                    <td className="px-5 py-4 text-[#4E8098]" colSpan={3}>Loading...</td>
                  </tr>
                ) : brands.length === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-[#4E8098]" colSpan={3}>No brands found.</td>
                  </tr>
                ) : (
                  brands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-[#FCF7F8]">
                      <td className="px-5 py-3 text-[#1a1a1a]">{brand.id}</td>
                      <td className="px-5 py-3 text-[#1a1a1a]">{brand.name}</td>
                      <td className="px-5 py-3 font-mono text-[#4E8098]">{brand.wallet_address}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="bg-white border border-[#CED3DC] overflow-hidden">
          <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Broadcaster Directory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-widest text-[#4E8098] bg-white border-b border-[#CED3DC]">
                <tr>
                  <th className="px-5 py-4 font-semibold">ID</th>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Wallet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {isLoading ? (
                  <tr>
                    <td className="px-5 py-4 text-[#4E8098]" colSpan={3}>Loading...</td>
                  </tr>
                ) : broadcasters.length === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-[#4E8098]" colSpan={3}>No broadcasters found.</td>
                  </tr>
                ) : (
                  broadcasters.map((broadcaster) => (
                    <tr key={broadcaster.id} className="hover:bg-[#FCF7F8]">
                      <td className="px-5 py-3 text-[#1a1a1a]">{broadcaster.id}</td>
                      <td className="px-5 py-3 text-[#1a1a1a]">{broadcaster.name}</td>
                      <td className="px-5 py-3 font-mono text-[#4E8098]">{broadcaster.wallet_address}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <article className="bg-white border border-[#CED3DC]">
          <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#4E8098]" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Register Brand</h3>
          </div>

          <form onSubmit={(event) => void handleBrandSubmit(event)} className="p-5 grid gap-4">
            {brandError ? <p className="text-xs font-semibold uppercase tracking-widest text-[#A31621]">{brandError}</p> : null}
            {brandSuccess ? <p className="text-xs font-semibold uppercase tracking-widest text-[#4E8098]">{brandSuccess}</p> : null}

            <input
              value={brandForm.orgName}
              onChange={(event) => updateBrandField("orgName", event.target.value)}
              placeholder="Brand name"
              disabled={isBrandSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              value={brandForm.username}
              onChange={(event) => updateBrandField("username", event.target.value)}
              placeholder="Username"
              disabled={isBrandSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              type="email"
              value={brandForm.email}
              onChange={(event) => updateBrandField("email", event.target.value)}
              placeholder="Email"
              disabled={isBrandSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              type="password"
              value={brandForm.password}
              onChange={(event) => updateBrandField("password", event.target.value)}
              placeholder="Password"
              disabled={isBrandSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleBrandLogoChange}
              disabled={isBrandSubmitting}
              className="w-full text-xs text-[#4E8098]"
            />

            <button
              type="submit"
              disabled={isBrandSubmitting}
              className="bg-[#1a1a1a] text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] disabled:opacity-60"
            >
              {isBrandSubmitting ? "Submitting..." : "Create Brand"}
            </button>
          </form>
        </article>

        <article className="bg-white border border-[#CED3DC]">
          <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#4E8098]" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Register Broadcaster</h3>
          </div>

          <form onSubmit={(event) => void handleBroadcasterSubmit(event)} className="p-5 grid gap-4">
            {broadcasterError ? <p className="text-xs font-semibold uppercase tracking-widest text-[#A31621]">{broadcasterError}</p> : null}
            {broadcasterSuccess ? <p className="text-xs font-semibold uppercase tracking-widest text-[#4E8098]">{broadcasterSuccess}</p> : null}

            <input
              value={broadcasterForm.orgName}
              onChange={(event) => updateBroadcasterField("orgName", event.target.value)}
              placeholder="Broadcaster name"
              disabled={isBroadcasterSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              value={broadcasterForm.username}
              onChange={(event) => updateBroadcasterField("username", event.target.value)}
              placeholder="Username"
              disabled={isBroadcasterSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              type="email"
              value={broadcasterForm.email}
              onChange={(event) => updateBroadcasterField("email", event.target.value)}
              placeholder="Email"
              disabled={isBroadcasterSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              type="password"
              value={broadcasterForm.password}
              onChange={(event) => updateBroadcasterField("password", event.target.value)}
              placeholder="Password"
              disabled={isBroadcasterSubmitting}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleBroadcasterLogoChange}
              disabled={isBroadcasterSubmitting}
              className="w-full text-xs text-[#4E8098]"
            />

            <button
              type="submit"
              disabled={isBroadcasterSubmitting}
              className="bg-[#1a1a1a] text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] disabled:opacity-60"
            >
              {isBroadcasterSubmitting ? "Submitting..." : "Create Broadcaster"}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
