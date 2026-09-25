import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';
import type { LockFormData } from '../types/lock';

interface ConfirmLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  formData: LockFormData;
  tokenSymbol: string;
  tokenBalance: string;
  isApproved: boolean;
  isSubmitting: boolean;
}

export function ConfirmLockModal({
  isOpen,
  onClose,
  onConfirm,
  formData,
  tokenSymbol,
  tokenBalance,
  isApproved,
  isSubmitting,
}: ConfirmLockModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('confirmLock.title')}>
      <div className="confirm-lock">
        <p className="confirm-lock__intro">
          {t('confirmLock.intro')}
        </p>

        <dl className="confirm-lock__details">
          <div className="confirm-lock__row">
            <dt>{t('confirmLock.amount')}</dt>
            <dd>
              {formData.amount} {tokenSymbol}
            </dd>
          </div>

          <div className="confirm-lock__row">
            <dt>{t('confirmLock.unlockDate')}</dt>
            <dd>{formData.unlockDate}</dd>
          </div>

          <div className="confirm-lock__row">
            <dt>{t('confirmLock.balance')}</dt>
            <dd>
              {t('confirmLock.balanceValue', {
                balance: tokenBalance,
                symbol: tokenSymbol,
              })}
            </dd>
          </div>

          <div className="confirm-lock__row">
            <dt>{t('confirmLock.approvalStatus')}</dt>
            <dd>
              {isApproved
                ? t('confirmLock.approved')
                : t('confirmLock.notApproved')}
            </dd>
          </div>
        </dl>

        <p className="confirm-lock__warning">
          {t('confirmLock.immutabilityWarning')}
        </p>

        <div className="confirm-lock__actions">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('confirmLock.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting || !isApproved}>
            {isSubmitting ? t('confirmLock.confirming') : t('confirmLock.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
