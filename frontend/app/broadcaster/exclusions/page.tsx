"use client";

import { useEffect, useMemo, useState } from "react";
import { Component, Plus } from "lucide-react";

import {
  BroadcasterApiError,
  addExclusionGroupMember,
  createExclusionGroup,
  deleteExclusionGroup,
  listBrands,
  listExclusionGroups,
  removeExclusionGroupMember,
  updateExclusionGroup,
  type BrandListItem,
  type ExclusionGroup as ApiExclusionGroup,
} from "@/lib/broadcasterApi";

type UiGroupMember = {
  brandId: number;
  brandName: string;
};

type UiExclusionGroup = {
  id: number;
  name: string;
  separationDistance: number;
  crossEvent: boolean;
  isLocked: boolean;
  members: UiGroupMember[];
};

const fallbackGroups: UiExclusionGroup[] = [
  {
    id: 1,
    name: "Beverages",
    separationDistance: 1,
    crossEvent: true,
    isLocked: false,
    members: [
      { brandId: 1, brandName: "Pepsi" },
      { brandId: 2, brandName: "Coca-Cola" },
      { brandId: 3, brandName: "7Up" },
    ],
  },
  {
    id: 2,
    name: "Telecom",
    separationDistance: 2,
    crossEvent: false,
    isLocked: false,
    members: [
      { brandId: 4, brandName: "Jazz" },
      { brandId: 5, brandName: "Zong" },
      { brandId: 6, brandName: "Telenor" },
    ],
  },
];

function mapApiGroup(group: ApiExclusionGroup): UiExclusionGroup {
  return {
    id: group.id,
    name: group.name,
    separationDistance: group.separation_distance,
    crossEvent: group.cross_event_separation,
    isLocked: group.is_locked,
    members: group.members.map((member) => ({
      brandId: member.brand_id,
      brandName: member.brand_name,
    })),
  };
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof BroadcasterApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export default function BroadcasterExclusionsPage() {
  const [groups, setGroups] = useState<UiExclusionGroup[]>(fallbackGroups);
  const [loadError, setLoadError] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSeparationDistance, setCreateSeparationDistance] = useState("1");
  const [createCrossEvent, setCreateCrossEvent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [brandsError, setBrandsError] = useState("");

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSeparationDistance, setEditSeparationDistance] = useState("1");
  const [editCrossEvent, setEditCrossEvent] = useState(false);
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [addBrandGroupId, setAddBrandGroupId] = useState<number | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [addBrandError, setAddBrandError] = useState("");
  const [isAddingBrand, setIsAddingBrand] = useState(false);

  const [pendingMemberKey, setPendingMemberKey] = useState<string | null>(null);
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadGroups(): Promise<void> {
      setLoadError("");

      try {
        const apiGroups = await listExclusionGroups();
        if (!isMounted) {
          return;
        }

        const mapped = apiGroups.map(mapApiGroup);
        setGroups(mapped.length ? mapped : fallbackGroups);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof BroadcasterApiError ? error.message : "Unable to load exclusion groups.";
        setLoadError(message);
        setGroups(fallbackGroups);
      }
    }

    void loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const brandsById = useMemo(() => {
    const map = new Map<number, BrandListItem>();
    for (const brand of brands) {
      map.set(brand.id, brand);
    }
    return map;
  }, [brands]);

  async function ensureBrandsLoaded(): Promise<BrandListItem[]> {
    if (brands.length > 0 || isLoadingBrands) {
      return brands;
    }

    setBrandsError("");
    setIsLoadingBrands(true);
    try {
      const allBrands = await listBrands();
      setBrands(allBrands);
      return allBrands;
    } catch (error) {
      setBrandsError(toMessage(error, "Unable to load brands."));
      return [];
    } finally {
      setIsLoadingBrands(false);
    }
  }

  function startEdit(group: UiExclusionGroup): void {
    if (group.isLocked) {
      return;
    }

    setEditError("");
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditSeparationDistance(String(group.separationDistance));
    setEditCrossEvent(group.crossEvent);
    setAddBrandGroupId(null);
    setAddBrandError("");
  }

  function cancelEdit(): void {
    setEditingGroupId(null);
    setEditError("");
    setIsSavingEdit(false);
  }

  async function handleCreateGroup(): Promise<void> {
    setCreateError("");
    const name = createName.trim();
    const separationDistance = Number.parseInt(createSeparationDistance, 10);

    if (!name) {
      setCreateError("Group name is required.");
      return;
    }

    if (!Number.isFinite(separationDistance) || separationDistance < 1) {
      setCreateError("Separation distance must be at least 1.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await createExclusionGroup({
        name,
        separation_distance: separationDistance,
        cross_event_separation: createCrossEvent,
      });

      const mapped = mapApiGroup(created);
      setGroups((previous) => [mapped, ...previous]);
      setIsCreateOpen(false);
      setCreateName("");
      setCreateSeparationDistance("1");
      setCreateCrossEvent(false);
    } catch (error) {
      setCreateError(toMessage(error, "Unable to create group."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveEdit(): Promise<void> {
    if (editingGroupId === null) {
      return;
    }

    setEditError("");
    const name = editName.trim();
    const separationDistance = Number.parseInt(editSeparationDistance, 10);

    if (!name) {
      setEditError("Group name is required.");
      return;
    }

    if (!Number.isFinite(separationDistance) || separationDistance < 1) {
      setEditError("Separation distance must be at least 1.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const updated = await updateExclusionGroup(editingGroupId, {
        name,
        separation_distance: separationDistance,
        cross_event_separation: editCrossEvent,
      });

      const mapped = mapApiGroup(updated);
      setGroups((previous) => previous.map((group) => (group.id === mapped.id ? mapped : group)));
      setEditingGroupId(null);
    } catch (error) {
      setEditError(toMessage(error, "Unable to update group."));
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteGroup(groupId: number): Promise<void> {
    setPendingDeleteGroupId(groupId);
    try {
      await deleteExclusionGroup(groupId);
      setGroups((previous) => previous.filter((group) => group.id !== groupId));
      if (editingGroupId === groupId) {
        setEditingGroupId(null);
      }
      if (addBrandGroupId === groupId) {
        setAddBrandGroupId(null);
      }
    } catch (error) {
      setLoadError(toMessage(error, "Unable to delete group."));
    } finally {
      setPendingDeleteGroupId(null);
    }
  }

  async function openAddBrand(group: UiExclusionGroup): Promise<void> {
    if (group.isLocked) {
      return;
    }

    setAddBrandError("");
    setEditingGroupId(null);
    setEditError("");
    setAddBrandGroupId(group.id);

    const existingIds = new Set(group.members.map((member) => member.brandId));
    const loadedBrands = await ensureBrandsLoaded();
    const firstAvailable = loadedBrands.find((brand) => !existingIds.has(brand.id));
    setSelectedBrandId(firstAvailable ? String(firstAvailable.id) : "");
  }

  async function handleAddBrand(): Promise<void> {
    if (addBrandGroupId === null) {
      return;
    }

    setAddBrandError("");
    const brandId = Number.parseInt(selectedBrandId, 10);
    if (!Number.isFinite(brandId)) {
      setAddBrandError("Select a brand to add.");
      return;
    }

    setIsAddingBrand(true);
    try {
      await addExclusionGroupMember(addBrandGroupId, brandId);

      const label = brandsById.get(brandId)?.name ?? `Brand ${brandId}`;
      setGroups((previous) =>
        previous.map((group) =>
          group.id === addBrandGroupId
            ? {
                ...group,
                members: [...group.members, { brandId, brandName: label }],
              }
            : group,
        ),
      );
    } catch (error) {
      setAddBrandError(toMessage(error, "Unable to add brand."));
    } finally {
      setIsAddingBrand(false);
    }
  }

  async function handleRemoveMember(groupId: number, brandId: number): Promise<void> {
    const key = `${groupId}:${brandId}`;
    setPendingMemberKey(key);
    try {
      await removeExclusionGroupMember(groupId, brandId);
      setGroups((previous) =>
        previous.map((group) =>
          group.id === groupId
            ? {
                ...group,
                members: group.members.filter((member) => member.brandId !== brandId),
              }
            : group,
        ),
      );
    } catch (error) {
      setLoadError(toMessage(error, "Unable to remove brand."));
    } finally {
      setPendingMemberKey(null);
    }
  }

  return (
    <div className="flex flex-col space-y-10 pb-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Component className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]">Protocol Config</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Exclusion Groups</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Manage competitor separation logic. Once an auction state rolls to OPEN, exclusion groups bound to that match are hardcoded and locked.
          </p>
        </div>
        
        <button
          type="button"
          onClick={() => {
            setIsCreateOpen((previous) => !previous);
          }}
          className="flex items-center gap-2 bg-[#1a1a1a] text-white px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Create Group
        </button>
      </header>

      {loadError ? (
        <div className="border border-[#A31621]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
          {loadError}
        </div>
      ) : null}

      {isCreateOpen ? (
        <section className="px-0 sm:px-6">
          <div className="border border-[#CED3DC] bg-white">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">New Exclusion Group</h3>
                <p className="text-[10px] text-[#4E8098]/80 mt-1 uppercase tracking-widest">Create a new separation pool</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] hover:text-[#1a1a1a] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="p-5 grid gap-4">
              {createError ? (
                <div className="border border-[#A31621]/30 bg-[#FCF7F8] p-3 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
                  {createError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Group Name</label>
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    disabled={isCreating}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    placeholder="e.g., Cola Brands"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Separation Distance</label>
                  <input
                    type="number"
                    min={1}
                    value={createSeparationDistance}
                    onChange={(event) => setCreateSeparationDistance(event.target.value)}
                    disabled={isCreating}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    checked={createCrossEvent}
                    onChange={(event) => setCreateCrossEvent(event.target.checked)}
                    disabled={isCreating}
                    className="w-4 h-4 accent-[#1a1a1a]"
                  />
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">Cross-event separation</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="border border-[#CED3DC] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] hover:bg-[#FCF7F8] hover:text-[#1a1a1a] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateGroup()}
                  disabled={isCreating}
                  className="bg-[#1a1a1a] text-white px-5 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] disabled:opacity-60"
                >
                  {isCreating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2 px-0 sm:px-6">
        {groups.map(group => (
          <div key={group.id} className="bg-white border border-[#CED3DC] flex flex-col">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex justify-between items-start">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">{group.name}</h3>
                <p className="text-[10px] text-[#4E8098] mt-1 font-mono">{group.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {group.crossEvent && <span className="bg-[#90C2E7]/20 text-[#1a1a1a] text-[10px] px-2 py-0.5 border border-[#90C2E7]/50 font-bold uppercase">Cross-Event Active</span>}
                {group.isLocked ? (
                  <span className="bg-white text-[#A31621] text-[10px] px-2 py-0.5 border border-[#A31621]/30 font-bold uppercase">Locked</span>
                ) : null}
              </div>
            </div>
            <div className="p-5 space-y-5 flex-1">
              {editingGroupId === group.id ? (
                <div className="space-y-4">
                  {editError ? (
                    <div className="border border-[#A31621]/30 bg-[#FCF7F8] p-3 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
                      {editError}
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Group Name</label>
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      disabled={isSavingEdit}
                      className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Separation Distance</label>
                      <input
                        type="number"
                        min={1}
                        value={editSeparationDistance}
                        onChange={(event) => setEditSeparationDistance(event.target.value)}
                        disabled={isSavingEdit}
                        className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        checked={editCrossEvent}
                        onChange={(event) => setEditCrossEvent(event.target.checked)}
                        disabled={isSavingEdit}
                        className="w-4 h-4 accent-[#1a1a1a]"
                      />
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">Cross-event separation</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => cancelEdit()}
                      disabled={isSavingEdit}
                      className="border border-[#CED3DC] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] hover:bg-[#FCF7F8] hover:text-[#1a1a1a] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      disabled={isSavingEdit}
                      className="bg-[#1a1a1a] text-white px-5 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] disabled:opacity-60"
                    >
                      {isSavingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteGroup(group.id)}
                      disabled={pendingDeleteGroupId === group.id}
                      className="border border-[#A31621]/30 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#A31621] hover:bg-[#FCF7F8] disabled:opacity-60"
                    >
                      {pendingDeleteGroupId === group.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">Separation Distance</span>
                    <span className="font-mono font-bold text-[#1a1a1a] bg-[#FCF7F8] px-2 py-1 border border-[#CED3DC]">{group.separationDistance} Slot(s)</span>
                  </div>
                  {!group.isLocked ? (
                    <button
                      type="button"
                      onClick={() => startEdit(group)}
                      className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] hover:text-[#1a1a1a] transition-colors"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              )}
              
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] mb-2 block">Brand Pool ({group.members.length})</span>
                <div className="flex flex-wrap gap-2">
                  {group.members.map((member) => (
                    <span key={`${group.id}-${member.brandId}`} className="text-xs bg-[#FCF7F8] border border-[#CED3DC] px-3 py-1 font-medium text-[#1a1a1a] flex items-center gap-2">
                      {member.brandName}
                      {!group.isLocked ? (
                        <button
                          type="button"
                          disabled={pendingMemberKey === `${group.id}:${member.brandId}`}
                          onClick={() => void handleRemoveMember(group.id, member.brandId)}
                          className="text-[10px] font-bold uppercase tracking-widest text-[#A31621] disabled:opacity-60"
                          title="Remove brand"
                        >
                          x
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {!group.isLocked ? (
                    <button
                      type="button"
                      onClick={() => void openAddBrand(group)}
                      className="text-xs bg-white border border-dashed border-[#CED3DC] text-[#4E8098] hover:border-[#1a1a1a] hover:text-[#1a1a1a] px-3 py-1 flex items-center justify-center transition-colors"
                      title="Add brand"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>

                {addBrandGroupId === group.id ? (
                  <div className="mt-4 border border-[#CED3DC] bg-white p-4">
                    {brandsError ? (
                      <div className="border border-[#A31621]/30 bg-[#FCF7F8] p-3 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
                        {brandsError}
                      </div>
                    ) : null}

                    {addBrandError ? (
                      <div className="border border-[#A31621]/30 bg-[#FCF7F8] p-3 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
                        {addBrandError}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Select Brand</label>
                        <select
                          value={selectedBrandId}
                          onChange={(event) => setSelectedBrandId(event.target.value)}
                          disabled={isLoadingBrands || isAddingBrand}
                          className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                        >
                          <option value="">{isLoadingBrands ? "Loading brands…" : "Choose a brand"}</option>
                          {brands
                            .filter((brand) => !group.members.some((member) => member.brandId === brand.id))
                            .map((brand) => (
                              <option key={brand.id} value={String(brand.id)}>
                                {brand.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddBrandGroupId(null);
                            setAddBrandError("");
                          }}
                          disabled={isAddingBrand}
                          className="border border-[#CED3DC] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] hover:bg-[#FCF7F8] hover:text-[#1a1a1a] disabled:opacity-60"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAddBrand()}
                          disabled={isAddingBrand}
                          className="bg-[#1a1a1a] text-white px-5 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] disabled:opacity-60"
                        >
                          {isAddingBrand ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}