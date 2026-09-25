import { useTranslation } from "react-i18next";

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onExtendAll: () => void;
  onTransferAll: () => void;
  onCancelSelection: () => void;
}

export default function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onExtendAll,
  onTransferAll,
  onCancelSelection,
}: BulkActionsToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="bulk-actions-toolbar">
      <span className="bulk-actions-toolbar__count">
        {t("myLocks.bulk.selectedCount", { count: selectedCount, total: totalCount })}
      </span>
      <div className="bulk-actions-toolbar__actions">
        <button type="button" onClick={onSelectAll}>
          {t("myLocks.bulk.selectAll")}
        </button>
        <button type="button" onClick={onExtendAll} disabled={selectedCount === 0}>
          {t("myLocks.bulk.extendAll")}
        </button>
        <button type="button" onClick={onTransferAll} disabled={selectedCount === 0}>
          {t("myLocks.bulk.transferAll")}
        </button>
        <button type="button" onClick={onCancelSelection}>
          {t("myLocks.bulk.cancelSelection")}
        </button>
      </div>
    </div>
  );
}
