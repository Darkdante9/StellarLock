import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface NotificationPreferencesProps {
  preferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
  };
  onChange?: (preferences: NotificationPreferencesProps['preferences']) => void;
}

export function NotificationPreferences({ preferences, onChange }: NotificationPreferencesProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState({
    email: preferences?.email ?? true,
    push: preferences?.push ?? true,
    sms: preferences?.sms ?? false,
    inApp: preferences?.inApp ?? true,
  });

  const update = (key: keyof typeof local, value: boolean) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange?.(next);
  };

  const channels = [
    {
      key: 'email' as const,
      icon: Mail,
      label: t('notifications.channels.email.label'),
      description: t('notifications.channels.email.description'),
    },
    {
      key: 'push' as const,
      icon: Smartphone,
      label: t('notifications.channels.push.label'),
      description: t('notifications.channels.push.description'),
    },
    {
      key: 'sms' as const,
      icon: MessageSquare,
      label: t('notifications.channels.sms.label'),
      description: t('notifications.channels.sms.description'),
    },
    {
      key: 'inApp' as const,
      icon: Bell,
      label: t('notifications.channels.inApp.label'),
      description: t('notifications.channels.inApp.description'),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notifications.preferences.title')}</CardTitle>
        <CardDescription>{t('notifications.preferences.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {channels.map(({ key, icon: Icon, label, description }) => (
          <div key={key} className="flex items-center justify-between space-x-4">
            <div className="flex items-start space-x-3">
              <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <Label htmlFor={`notification-${key}`}>{label}</Label>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              id={`notification-${key}`}
              checked={local[key]}
              onCheckedChange={(value) => update(key, value)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
