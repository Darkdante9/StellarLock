import { useTranslation } from "react-i18next"
import { Lock as LockIcon, Unlock, Check } from "lucide-react"
import type { LockStatus } from "@/types/lock"
import { Badge } from "@/components/ui/Badge"

export function StatusBadge({ status }: { status: LockStatus }) {
  const { t } = useTranslation()

  if (status === "locked") {
    return (
      <Badge variant="primary">
        <LockIcon className="h-3 w-3" />
        {t("lockStatus.locked")}
      </Badge>
    )
  }
  if (status === "unlockable") {
    return (
      <Badge variant="warning">
        <Unlock className="h-3 w-3" />
        {t("lockStatus.unlockable")}
      </Badge>
    )
  }
  return (
    <Badge variant="outline">
      <Check className="h-3 w-3" />
      {t("lockStatus.withdrawn")}
    </Badge>
  )
}
