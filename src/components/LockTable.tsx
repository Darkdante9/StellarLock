import { useTranslation } from "react-i18next";
import type { Lock } from "../types";

interface LockTableProps {
  locks: Lock[];
  onSelect?: (lock: Lock) => void;
}

export function LockTable({ locks, onSelect }: LockTableProps) {
  const { t } = useTranslation();

  if (locks.length === 0) {
    return <p className="lock-table__empty">{t("discover.noLocks")}</p>;
  }

  return (
    <table className="lock-table">
      <thead>
        <tr>
          <th>{t("locks.columns.amount")}</th>
          <th>{t("locks.columns.beneficiary")}</th>
          <th>{t("locks.columns.unlockDate")}</th>
          <th>{t("locks.columns.unlocksIn")}</th>
          <th>{t("locks.columns.status")}</th>
        </tr>
      </thead>
      <tbody>
        {locks.map((lock) => (
          <tr key={lock.id} onClick={() => onSelect?.(lock)}>
            <td>{lock.amount}</td>
            <td>{lock.beneficiary}</td>
            <td>{lock.unlockDate}</td>
            <td>{lock.unlocksIn}</td>
            <td>{lock.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
