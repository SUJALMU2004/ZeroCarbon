interface EditStickyBarProps {
  isSaving: boolean;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export default function EditStickyBar({
  isSaving,
  canSave,
  onCancel,
  onSave,
}: EditStickyBarProps) {
  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4 md:bottom-4 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg ring-1 ring-black/5">
        <p className="text-sm text-gray-600">You have edit access for this project.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !canSave}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

